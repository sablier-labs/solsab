use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn cancel(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses, is_pending_stream: bool) {
    // Get sender (must match the stream's sender)
    let sender = fuzz_accounts.sender.get(trident).unwrap();

    // Get deposit token info
    let deposited_token_mint = fuzz_accounts.deposit_token_mint.get(trident).unwrap();
    let deposited_token_program = fuzz_accounts.deposit_token_program.get(trident).unwrap();

    // Get stream NFT mint
    let stream_nft_mint = fuzz_accounts.stream_nft_mint.get(trident).unwrap();

    // Get stream data PDA
    let stream_data = fuzz_accounts.stream_data.get(trident).unwrap();

    // Derive sender ATA (init_if_needed in the instruction)
    let ata_program: Pubkey = ASSOCIATED_TOKEN_PROGRAM_ID.parse().unwrap();
    let sender_ata = fuzz_accounts.sender_ata.insert(
        trident,
        Some(PdaSeeds::new(
            &[sender.as_ref(), deposited_token_program.as_ref(), deposited_token_mint.as_ref()],
            ata_program,
        )),
    );

    // Get stream data ATA
    let stream_data_ata = fuzz_accounts.stream_data_ata.get(trident).unwrap();

    // Build instruction accounts
    let accounts = CancelInstructionAccounts::new(
        sender,
        sender_ata,
        deposited_token_mint,
        stream_data,
        stream_data_ata,
        stream_nft_mint,
        deposited_token_program,
    );

    // Build instruction data (empty for Cancel)
    let data = CancelInstructionData::new();

    // Capture amounts before cancel
    let expected_refund_amount = get_refundable_amount(trident, &stream_data);
    let sender_ata_balance_before = get_ata_token_balance(trident, &sender_ata);
    let stream_data_ata_balance_before = get_ata_token_balance(trident, &stream_data_ata);

    let ix = CancelInstruction::data(data).accounts(accounts.clone()).instruction();
    let result = trident.process_transaction(&[ix], Some("Cancel"));
    assert!(result.is_success(), "Cancel transaction failed");

    // Verify accounts and data
    assertions(
        trident,
        &accounts,
        expected_refund_amount,
        sender_ata_balance_before,
        stream_data_ata_balance_before,
        is_pending_stream,
    );
}

fn assertions(
    trident: &mut Trident,
    accounts: &CancelInstructionAccounts,
    expected_refund_amount: u64,
    sender_ata_balance_before: u64,
    stream_data_ata_balance_before: u64,
    is_pending_stream: bool,
) {
    // Data assertions - retrieve and verify stream data
    let stream_data = get_stream_data(trident, &accounts.stream_data);

    // Verify is_cancelable is now false (stream was canceled)
    assert!(!stream_data.is_cancelable, "is_cancelable should be false after cancel");

    // Verify was_canceled is now true
    assert!(stream_data.was_canceled, "was_canceled should be true after cancel");

    // Verify the correct stream state based on whether it was pending or streaming
    if is_pending_stream {
        assert!(stream_data.is_depleted, "is_depleted should be true for a canceled pending stream");
    } else {
        assert!(!stream_data.is_depleted, "is_depleted should be false for a canceled streaming stream");
    }

    // Verify refunded amount is correct
    let actual_refund_amount = stream_data.amounts.refunded;
    assert!(actual_refund_amount == expected_refund_amount, "refunded amount does not match expected");

    // Verify stream_data_ata balance decreased by refund_amount
    let stream_data_ata_balance_after = get_ata_token_balance(trident, &accounts.stream_data_ata);
    assert_eq!(
        stream_data_ata_balance_before - stream_data_ata_balance_after,
        actual_refund_amount,
        "stream_data_ata balance should decrease by refunded amount"
    );

    // Verify sender_ata balance increased by refund_amount
    let sender_ata_balance_after = get_ata_token_balance(trident, &accounts.sender_ata);
    assert_eq!(
        sender_ata_balance_after - sender_ata_balance_before,
        actual_refund_amount,
        "sender_ata balance should increase by refunded amount"
    );
}
