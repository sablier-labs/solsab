use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

/// Shared account fields for all Create instructions.
#[derive(Clone)]
pub struct CreateAccounts {
    pub funder: Pubkey,
    pub funder_ata: Pubkey,
    pub recipient: Pubkey,
    pub sender: Pubkey,
    pub treasury: Pubkey,
    pub stream_nft_collection: Pubkey,
    pub deposit_token_mint: Pubkey,
    pub stream_data: Pubkey,
    pub stream_data_ata: Pubkey,
    pub stream_nft: Pubkey,
    pub deposit_token_program: Pubkey,
}

/// Derives all accounts needed for Create instructions.
pub fn derive_create_accounts(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses, salt: u128) -> CreateAccounts {
    let program_id = program_id();

    let funder = fuzz_accounts.funder.get(trident).unwrap();
    let deposit_token_mint = fuzz_accounts.deposit_token_mint.get(trident).unwrap();
    let deposit_token_program = fuzz_accounts.deposit_token_program.get(trident).unwrap();
    let recipient = fuzz_accounts.recipient.get(trident).unwrap();
    let sender = fuzz_accounts.sender.get(trident).unwrap();
    let treasury = fuzz_accounts.treasury.get(trident).unwrap();
    let stream_nft_collection = fuzz_accounts.stream_nft_collection.get(trident).unwrap();

    let ata_program: Pubkey = ASSOCIATED_TOKEN_PROGRAM_ID.parse().unwrap();

    let funder_ata = fuzz_accounts.funder_ata.insert(
        trident,
        Some(PdaSeeds::new(
            &[funder.as_ref(), deposit_token_program.as_ref(), deposit_token_mint.as_ref()],
            ata_program,
        )),
    );

    let stream_nft = fuzz_accounts
        .stream_nft
        .insert(trident, Some(PdaSeeds::new(&[STREAM_NFT, sender.as_ref(), &salt.to_le_bytes()], program_id)));

    let stream_data = fuzz_accounts
        .stream_data
        .insert(trident, Some(PdaSeeds::new(&[STREAM_DATA, stream_nft.as_ref()], program_id)));

    let stream_data_ata = fuzz_accounts.stream_data_ata.insert(
        trident,
        Some(PdaSeeds::new(
            &[stream_data.as_ref(), deposit_token_program.as_ref(), deposit_token_mint.as_ref()],
            ata_program,
        )),
    );

    CreateAccounts {
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
    }
}

/// Mints tokens to the funder's ATA for stream creation.
pub fn mint_deposit_tokens(trident: &mut Trident, accounts: &CreateAccounts, deposit_amount: u64) {
    let mint_tokens_ix = if is_token_2022(&accounts.deposit_token_program) {
        trident.mint_to_2022(&accounts.funder_ata, &accounts.deposit_token_mint, &accounts.funder, deposit_amount)
    } else {
        trident.mint_to(&accounts.funder_ata, &accounts.deposit_token_mint, &accounts.funder, deposit_amount)
    };
    let mint_result = trident.process_transaction(&[mint_tokens_ix], None);
    assert!(mint_result.is_success(), "Failed to mint {deposit_amount} tokens to funder ATA");
}

/// Shared assertions for all Create instructions. Verifies account existence, NFT ownership,
/// amounts, metadata fields, token balances, and universal invariants.
/// Returns the deserialized StreamData for caller-specific timestamp/duration assertions.
pub fn assert_create(
    trident: &mut Trident,
    accounts: &CreateAccounts,
    deposit_amount: u64,
    start_unlock_amount: u64,
    cliff_unlock_amount: u64,
    salt: u128,
    is_cancelable: bool,
    funder_ata_balance_before: u64,
) -> crate::types::StreamData {
    // Account existence
    assert!(account_exists(trident, &accounts.stream_nft), "stream_nft account was not created");
    assert!(account_exists(trident, &accounts.stream_data), "stream_data account was not created");
    assert!(account_exists(trident, &accounts.stream_data_ata), "stream_data_ata account was not created");

    // NFT ownership
    let nft_owner = get_mpl_core_asset_owner(trident, &accounts.stream_nft);
    assert_eq!(nft_owner, accounts.recipient, "stream NFT should be owned by the recipient");

    // Stream data
    let stream_data = get_stream_data(trident, &accounts.stream_data);
    let (_, _, _, start_unlock, cliff_unlock) = get_linear_params(&stream_data);

    // Amounts
    assert_eq!(stream_data.amounts.deposited, deposit_amount, "deposit_amount mismatch");
    assert_eq!(start_unlock, start_unlock_amount, "start_unlock_amount mismatch");
    assert_eq!(cliff_unlock, cliff_unlock_amount, "cliff_unlock_amount mismatch");
    assert_eq!(stream_data.amounts.withdrawn, 0, "withdrawn should be 0 initially");
    assert_eq!(stream_data.amounts.refunded, 0, "refunded should be 0 initially");

    // Metadata
    assert_eq!(stream_data.salt, salt, "salt mismatch");
    assert_eq!(stream_data.is_cancelable, is_cancelable, "is_cancelable mismatch");
    assert_eq!(stream_data.deposited_token_mint, accounts.deposit_token_mint, "deposit_token_mint mismatch");
    assert_eq!(stream_data.sender, accounts.sender, "sender mismatch");
    assert!(!stream_data.is_depleted, "is_depleted should be false initially");
    assert!(!stream_data.was_canceled, "was_canceled should be false initially");

    // Token balances
    let stream_data_ata_balance = get_ata_token_balance(trident, &accounts.stream_data_ata);
    assert_eq!(stream_data_ata_balance, deposit_amount, "stream_data_ata balance should equal deposit_amount");

    let funder_ata_balance_after = get_ata_token_balance(trident, &accounts.funder_ata);
    assert_eq!(
        funder_ata_balance_before - funder_ata_balance_after,
        deposit_amount,
        "funder_ata balance should decrease by deposit_amount"
    );

    // Universal invariants
    check_universal_invariants(trident, &accounts.stream_data, &accounts.stream_data_ata);

    stream_data
}
