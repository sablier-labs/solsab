use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn create_with_timestamps_ll(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses, is_default_stream: bool) {
    let program_id = program_id();

    // Salt needed for PDA derivation
    let salt: u128 = if is_default_stream {
        1
    } else {
        trident.random_from_range(2..(u128::MAX - 1))
    };

    // Get values needed for PDA derivations
    let funder = fuzz_accounts.funder.get(trident).unwrap();
    let deposit_token_mint = fuzz_accounts.deposit_token_mint.get(trident).unwrap();
    let deposit_token_program = fuzz_accounts.deposit_token_program.get(trident).unwrap();
    let recipient = fuzz_accounts.recipient.get(trident).unwrap();
    let sender = fuzz_accounts.sender.get(trident).unwrap();
    let treasury = fuzz_accounts.treasury.get(trident).unwrap();
    let stream_nft_collection = fuzz_accounts.stream_nft_collection.get(trident).unwrap();

    let ata_program: Pubkey = ASSOCIATED_TOKEN_PROGRAM_ID.parse().unwrap();

    // Derive funder ATA
    let funder_ata = fuzz_accounts.funder_ata.insert(
        trident,
        Some(PdaSeeds::new(
            &[funder.as_ref(), deposit_token_program.as_ref(), deposit_token_mint.as_ref()],
            ata_program,
        )),
    );

    // Derive stream NFT PDA (MPL Core asset)
    let stream_nft = fuzz_accounts
        .stream_nft
        .insert(trident, Some(PdaSeeds::new(&[STREAM_NFT, sender.as_ref(), &salt.to_le_bytes()], program_id)));

    // Derive stream data PDA
    let stream_data = fuzz_accounts
        .stream_data
        .insert(trident, Some(PdaSeeds::new(&[STREAM_DATA, stream_nft.as_ref()], program_id)));

    // Derive stream data ATA
    let stream_data_ata = fuzz_accounts.stream_data_ata.insert(
        trident,
        Some(PdaSeeds::new(
            &[stream_data.as_ref(), deposit_token_program.as_ref(), deposit_token_mint.as_ref()],
            ata_program,
        )),
    );

    // Build instruction accounts
    let accounts = CreateWithTimestampsLlInstructionAccounts::new(
        funder,
        funder_ata,
        recipient,
        sender,
        treasury,
        stream_nft_collection,
        deposit_token_mint,
        stream_data,
        stream_data_ata,
        stream_nft,
        deposit_token_program,
    );

    // Build instruction data
    let data = get_data(trident, salt, is_default_stream);

    // Mint tokens to funder's ATA
    let mint_tokens_ix = trident.mint_to(&funder_ata, &deposit_token_mint, &funder, data.deposit_amount);
    let mint_result = trident.process_transaction(&[mint_tokens_ix], None);
    assert!(mint_result.is_success(), "Failed to mint {} tokens to funder ATA", data.deposit_amount);

    let ix = CreateWithTimestampsLlInstruction::data(data.clone()).accounts(accounts.clone()).instruction();
    let result = trident.process_transaction(&[ix], Some("CreateWithTimestampsLL"));
    assert!(result.is_success(), "CreateWithTimestampsLL transaction failed");

    // Verify accounts and data
    assertions(trident, accounts, data);
}

// Returns the instruction data for creating a stream with timestamps
fn get_data(trident: &mut Trident, salt: u128, is_default_stream: bool) -> CreateWithTimestampsLlInstructionData {
    // If default stream, return fixed parameters
    if is_default_stream {
        return CreateWithTimestampsLlInstructionData::new(
            salt,
            DEPOSIT_AMOUNT,
            START_TIME,
            CLIFF_TIME,
            END_TIME,
            START_AMOUNT,
            CLIFF_AMOUNT,
            true,
        );
    }
    // Otherwise, generate random parameters

    // Generate random deposit amount (cap at 1 billion tokens with decimals to avoid overflow issues)
    let deposit_amount = trident.random_from_range(1..1_000_000_000 * DECIMALS_MULTIPLIER);

    // Generate random start time
    let start_time = trident.random_from_range(START_TIME..START_TIME + 10_000);

    // Determine cliff and end times
    let random_cliff_selector = trident.random_from_range(1..10);
    let (cliff_time, end_time) = if random_cliff_selector == 1 {
        // No cliff
        let end = trident.random_from_range(start_time + 1..start_time + 1_000_000);
        (0, end)
    } else {
        // With cliff
        let cliff = trident.random_from_range(start_time + 1..start_time + 100_000);
        let end = trident.random_from_range(cliff + 1..cliff + 1_000_000);
        (cliff, end)
    };

    // Generate random amounts
    // Ensure start_amount + cliff_amount < deposit_amount (at least 1 token streams over time)
    let start_amount = trident.random_from_range(0..deposit_amount);
    let cliff_amount = if cliff_time > 0 {
        trident.random_from_range(0..deposit_amount - start_amount)
    } else {
        0
    };

    // Generate random cancelable flag
    let cancelable = trident.random_bool();

    CreateWithTimestampsLlInstructionData::new(
        salt,
        deposit_amount,
        start_time,
        cliff_time,
        end_time,
        start_amount,
        cliff_amount,
        cancelable,
    )
}

fn assertions(
    trident: &mut Trident,
    accounts: CreateWithTimestampsLlInstructionAccounts,
    data: CreateWithTimestampsLlInstructionData,
) {
    // Account assertions - verify accounts were created
    assert!(account_exists(trident, &accounts.stream_nft), "stream_nft account was not created");
    assert!(account_exists(trident, &accounts.stream_data), "stream_data account was not created");
    assert!(account_exists(trident, &accounts.stream_data_ata), "stream_data_ata account was not created");

    // Verify the stream NFT is owned by the recipient
    let nft_owner = get_mpl_core_asset_owner(trident, &accounts.stream_nft);
    assert_eq!(nft_owner, accounts.recipient, "stream NFT should be owned by the recipient");

    // Data assertions - retrieve and verify stream data
    let stream_data = get_stream_data(trident, &accounts.stream_data);

    // Extract linear timestamps and unlock amounts from the model
    let (start, cliff, end, start_unlock, cliff_unlock) = get_linear_params(&stream_data);

    // Verify timestamps
    assert_eq!(start, data.start_time, "start_time mismatch");
    assert_eq!(cliff, data.cliff_time, "cliff_time mismatch");
    assert_eq!(end, data.end_time, "end_time mismatch");

    // Verify amounts
    assert_eq!(stream_data.amounts.deposited, data.deposit_amount, "deposit_amount mismatch");
    assert_eq!(start_unlock, data.start_unlock_amount, "start_unlock_amount mismatch");
    assert_eq!(cliff_unlock, data.cliff_unlock_amount, "cliff_unlock_amount mismatch");
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

    // Universal invariants
    check_universal_invariants(trident, &accounts.stream_data, &accounts.stream_data_ata);
}
