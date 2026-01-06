use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn create_with_durations_ll(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses) {
    let program_id = program_id();

    // Random salt for PDA derivation
    let salt: u128 = trident.random_from_range(2..(u128::MAX - 1));

    // Get values needed for PDA derivations
    let creator = fuzz_accounts.creator.get(trident).unwrap();
    let deposit_token_mint = fuzz_accounts.deposit_token_mint.get(trident).unwrap();
    let deposit_token_program = fuzz_accounts.deposit_token_program.get(trident).unwrap();
    let recipient = fuzz_accounts.recipient.get(trident).unwrap();
    let sender = fuzz_accounts.sender.get(trident).unwrap();
    let nft_token_program = fuzz_accounts.nft_token_program.get(trident).unwrap();

    let ata_program: Pubkey = ASSOCIATED_TOKEN_PROGRAM_ID.parse().unwrap();
    let metadata_program: Pubkey = TOKEN_METADATA_PROGRAM_ID.parse().unwrap();

    // Derive creator ATA
    let creator_ata = fuzz_accounts.creator_ata.insert(
        trident,
        Some(PdaSeeds::new(
            &[creator.as_ref(), deposit_token_program.as_ref(), deposit_token_mint.as_ref()],
            ata_program,
        )),
    );

    // Derive stream NFT mint PDA
    let stream_nft_mint = fuzz_accounts
        .stream_nft_mint
        .insert(trident, Some(PdaSeeds::new(&[STREAM_NFT_MINT, sender.as_ref(), &salt.to_le_bytes()], program_id)));

    // Derive recipient stream NFT ATA
    let recipient_stream_nft_ata = fuzz_accounts.recipient_stream_nft_ata.insert(
        trident,
        Some(PdaSeeds::new(&[recipient.as_ref(), nft_token_program.as_ref(), stream_nft_mint.as_ref()], ata_program)),
    );

    // Derive stream data PDA
    let stream_data = fuzz_accounts
        .stream_data
        .insert(trident, Some(PdaSeeds::new(&[STREAM_DATA, stream_nft_mint.as_ref()], program_id)));

    // Derive stream data ATA
    let stream_data_ata = fuzz_accounts.stream_data_ata.insert(
        trident,
        Some(PdaSeeds::new(
            &[stream_data.as_ref(), deposit_token_program.as_ref(), deposit_token_mint.as_ref()],
            ata_program,
        )),
    );

    // Derive stream NFT master edition
    let stream_nft_master_edition = fuzz_accounts.stream_nft_master_edition.insert(
        trident,
        Some(PdaSeeds::new(
            &[METADATA, metadata_program.as_ref(), stream_nft_mint.as_ref(), EDITION],
            metadata_program,
        )),
    );

    // Derive stream NFT metadata
    let stream_nft_metadata = fuzz_accounts.stream_nft_metadata.insert(
        trident,
        Some(PdaSeeds::new(&[METADATA, metadata_program.as_ref(), stream_nft_mint.as_ref()], metadata_program)),
    );

    // Build instruction accounts (NFT collection accounts fetched inline)
    let accounts = CreateWithDurationsLlInstructionAccounts::new(
        creator,
        creator_ata,
        recipient,
        sender,
        fuzz_accounts.nft_collection_data.get(trident).unwrap(),
        fuzz_accounts.nft_collection_master_edition.get(trident).unwrap(),
        fuzz_accounts.nft_collection_metadata.get(trident).unwrap(),
        fuzz_accounts.nft_collection_mint.get(trident).unwrap(),
        deposit_token_mint,
        stream_nft_mint,
        recipient_stream_nft_ata,
        stream_data,
        stream_data_ata,
        stream_nft_master_edition,
        stream_nft_metadata,
        deposit_token_program,
        nft_token_program,
    );

    // Build instruction data
    let data = get_data(trident, salt);

    // Mint tokens to creator's ATA
    let mint_tokens_ix = trident.mint_to(&creator_ata, &deposit_token_mint, &creator, data.deposit_amount);
    let mint_result = trident.process_transaction(&[mint_tokens_ix], None);
    assert!(mint_result.is_success(), "Failed to mint {} tokens to creator ATA", data.deposit_amount);

    let ix = CreateWithDurationsLlInstruction::data(data.clone()).accounts(accounts.clone()).instruction();
    let result = trident.process_transaction(&[ix], Some("CreateWithDurationsLL"));
    assert!(result.is_success(), "CreateWithDurationsLL transaction failed");

    // Verify accounts and data
    assertions(trident, accounts, data);
}

fn get_data(trident: &mut Trident, salt: u128) -> CreateWithDurationsLlInstructionData {
    // Generate random deposit amount (cap at 1 billion tokens with decimals to avoid overflow issues)
    let deposit_amount = trident.random_from_range(1..1_000_000_000 * DECIMALS_MULTIPLIER);

    // Determine cliff and total durations
    let random_cliff_selector = trident.random_from_range(1..10);
    let (cliff_duration, total_duration) = if random_cliff_selector == 1 {
        // No cliff
        let total = trident.random_from_range(1..1_000_000);
        (0, total)
    } else {
        // With cliff
        let cliff = trident.random_from_range(1..100_000);
        let total = trident.random_from_range(cliff + 1..cliff + 1_000_000);
        (cliff, total)
    };

    // Generate random amounts
    // Ensure start_amount + cliff_amount < deposit_amount (at least 1 token streams over time)
    let start_amount = trident.random_from_range(0..deposit_amount);
    let cliff_amount = if cliff_duration > 0 {
        trident.random_from_range(0..deposit_amount - start_amount)
    } else {
        0
    };

    // Generate random cancelable flag
    let cancelable = trident.random_bool();

    CreateWithDurationsLlInstructionData::new(salt, deposit_amount, cliff_duration, total_duration, start_amount, cliff_amount, cancelable)
}

fn assertions(
    trident: &mut Trident,
    accounts: CreateWithDurationsLlInstructionAccounts,
    data: CreateWithDurationsLlInstructionData,
) {
    // Account assertions - verify accounts were created
    assert!(account_exists(trident, &accounts.stream_nft_mint), "stream_nft_mint account was not created");
    assert!(
        account_exists(trident, &accounts.recipient_stream_nft_ata),
        "recipient_stream_nft_ata account was not created"
    );
    assert!(account_exists(trident, &accounts.stream_data), "stream_data account was not created");
    assert!(account_exists(trident, &accounts.stream_data_ata), "stream_data_ata account was not created");
    assert!(
        account_exists(trident, &accounts.stream_nft_master_edition),
        "stream_nft_master_edition account was not created"
    );
    assert!(account_exists(trident, &accounts.stream_nft_metadata), "stream_nft_metadata account was not created");

    // Data assertions - retrieve and verify stream data
    let stream_data = get_stream_data(trident, &accounts.stream_data);

    // Verify durations were converted to timestamps correctly
    // The on-chain program converts durations to timestamps based on current time
    // We verify the relative relationships hold
    let start_time = stream_data.timestamps.start;
    let cliff_time = stream_data.timestamps.cliff;
    let end_time = stream_data.timestamps.end;

    if data.cliff_duration > 0 {
        assert_eq!(cliff_time - start_time, data.cliff_duration, "cliff_duration mismatch");
    } else {
        assert_eq!(cliff_time, 0, "cliff_time should be 0 when no cliff");
    }
    assert_eq!(end_time - start_time, data.total_duration, "total_duration mismatch");

    // Verify amounts
    assert_eq!(stream_data.amounts.deposited, data.deposit_amount, "deposit_amount mismatch");
    assert_eq!(stream_data.amounts.start_unlock, data.start_unlock_amount, "start_unlock_amount mismatch");
    assert_eq!(stream_data.amounts.cliff_unlock, data.cliff_unlock_amount, "cliff_unlock_amount mismatch");
    assert_eq!(stream_data.amounts.withdrawn, 0, "withdrawn should be 0 initially");
    assert_eq!(stream_data.amounts.refunded, 0, "refunded should be 0 initially");

    // Verify other fields
    assert_eq!(stream_data.salt, data.salt, "salt mismatch");
    assert_eq!(stream_data.is_cancelable, data.is_cancelable, "is_cancelable mismatch");
    assert_eq!(stream_data.deposited_token_mint, accounts.deposit_token_mint, "deposit_token_mint mismatch");
    assert_eq!(stream_data.sender, accounts.sender, "sender mismatch");
    assert!(!stream_data.is_depleted, "is_depleted should be false initially");
    assert!(!stream_data.was_canceled, "was_canceled should be false initially");

    // Verify token balances
    let stream_data_ata_balance = get_ata_token_balance(trident, &accounts.stream_data_ata);
    assert_eq!(stream_data_ata_balance, data.deposit_amount, "stream_data_ata balance should equal deposit_amount");

    // Verify stream NFT mint supply
    let stream_nft_mint_supply = get_mint_total_supply(trident, &accounts.stream_nft_mint);
    assert_eq!(stream_nft_mint_supply, 1, "Stream NFT Mint total supply should be 1");

    // Verify recipient received the stream NFT
    let recipient_nft_balance = get_ata_token_balance(trident, &accounts.recipient_stream_nft_ata);
    assert_eq!(recipient_nft_balance, 1, "recipient should have 1 stream NFT");
}
