use crate::helpers::*;
use crate::types::StreamData;
use trident_fuzz::fuzzing::*;

// =============================================================================
// CREATE STREAM ASSERTIONS
// =============================================================================

/// Expected values for stream creation assertions.
pub struct CreateExpected {
    pub salt: u128,
    pub deposit_amount: u64,
    pub start_unlock_amount: u64,
    pub cliff_unlock_amount: u64,
    pub is_cancelable: bool,
}

/// Asserts that all stream accounts were created correctly.
pub fn assert_stream_accounts_created(trident: &mut Trident, accounts: &CreateStreamAccounts) {
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
}

/// Asserts stream data fields (common to both timestamp and duration variants).
pub fn assert_stream_data_fields(trident: &mut Trident, accounts: &CreateStreamAccounts, expected: &CreateExpected) {
    let stream_data = get_stream_data(trident, &accounts.stream_data);

    // Verify amounts
    assert_eq!(stream_data.amounts.deposited, expected.deposit_amount, "deposit_amount mismatch");
    assert_eq!(stream_data.amounts.start_unlock, expected.start_unlock_amount, "start_unlock_amount mismatch");
    assert_eq!(stream_data.amounts.cliff_unlock, expected.cliff_unlock_amount, "cliff_unlock_amount mismatch");
    assert_eq!(stream_data.amounts.withdrawn, 0, "withdrawn should be 0 initially");
    assert_eq!(stream_data.amounts.refunded, 0, "refunded should be 0 initially");

    // Verify other fields
    assert_eq!(stream_data.salt, expected.salt, "salt mismatch");
    assert_eq!(stream_data.is_cancelable, expected.is_cancelable, "is_cancelable mismatch");
    assert_eq!(stream_data.deposited_token_mint, accounts.deposit_token_mint, "deposit_token_mint mismatch");
    assert_eq!(stream_data.sender, accounts.sender, "sender mismatch");
    assert!(!stream_data.is_depleted, "is_depleted should be false initially");
    assert!(!stream_data.was_canceled, "was_canceled should be false initially");
}

/// Asserts token balances after stream creation.
pub fn assert_stream_token_balances(trident: &mut Trident, accounts: &CreateStreamAccounts, deposit_amount: u64) {
    // Verify stream_data_ata balance
    let stream_data_ata_balance = get_ata_token_balance(trident, &accounts.stream_data_ata);
    assert_eq!(stream_data_ata_balance, deposit_amount, "stream_data_ata balance should equal deposit_amount");

    // Verify stream NFT mint supply
    let stream_nft_mint_supply = get_mint_total_supply(trident, &accounts.stream_nft_mint);
    assert_eq!(stream_nft_mint_supply, 1, "Stream NFT Mint total supply should be 1");

    // Verify recipient received the stream NFT
    let recipient_nft_balance = get_ata_token_balance(trident, &accounts.recipient_stream_nft_ata);
    assert_eq!(recipient_nft_balance, 1, "recipient should have 1 stream NFT");
}

// =============================================================================
// WITHDRAWAL ASSERTIONS
// =============================================================================

/// Asserts withdrawal was executed correctly.
pub fn assert_withdrawal(
    trident: &mut Trident,
    accounts: &WithdrawalAccounts,
    withdraw_amount: u64,
    recipient_ata_balance_before: u64,
    stream_data_ata_balance_before: u64,
) {
    let stream_data = get_stream_data(trident, &accounts.stream_data);

    // Verify withdrawn amount increased
    assert_eq!(stream_data.amounts.withdrawn, withdraw_amount, "withdrawn amount should match withdraw_amount");

    // Verify recipient ATA balance increased
    let recipient_ata_balance_after = get_ata_token_balance(trident, &accounts.withdrawal_recipient_ata);
    assert_eq!(
        recipient_ata_balance_after - recipient_ata_balance_before,
        withdraw_amount,
        "recipient ATA balance should increase by withdraw_amount"
    );

    // Verify stream_data_ata balance decreased
    let stream_data_ata_balance_after = get_ata_token_balance(trident, &accounts.stream_data_ata);
    assert_eq!(
        stream_data_ata_balance_before - stream_data_ata_balance_after,
        withdraw_amount,
        "stream_data_ata balance should decrease by withdraw_amount"
    );

    // Verify is_depleted when fully withdrawn
    assert_depleted_if_complete(&stream_data);
}

/// Asserts is_depleted flag when stream is fully consumed.
fn assert_depleted_if_complete(stream_data: &StreamData) {
    if stream_data.amounts.withdrawn + stream_data.amounts.refunded == stream_data.amounts.deposited {
        assert!(stream_data.is_depleted, "is_depleted should be true when withdrawn + refunded = deposited");
    }
}
