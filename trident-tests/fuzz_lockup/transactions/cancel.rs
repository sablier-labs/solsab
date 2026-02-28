use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn cancel(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses) {
    // Prepare instruction accounts
    let sender = fuzz_accounts.sender.get(trident).unwrap();
    let deposited_token_mint = fuzz_accounts.deposit_token_mint.get(trident).unwrap();
    let deposited_token_program = fuzz_accounts.deposit_token_program.get(trident).unwrap();
    let stream_nft = fuzz_accounts.stream_nft.get(trident).unwrap();
    let stream_data = fuzz_accounts.stream_data.get(trident).unwrap();
    let stream_data_ata = fuzz_accounts.stream_data_ata.get(trident).unwrap();
    let ata_program: Pubkey = ASSOCIATED_TOKEN_PROGRAM_ID.parse().unwrap();
    let sender_ata = fuzz_accounts.sender_ata.insert(
        trident,
        Some(PdaSeeds::new(
            &[sender.as_ref(), deposited_token_program.as_ref(), deposited_token_mint.as_ref()],
            ata_program,
        )),
    );

    let accounts = CancelInstructionAccounts::new(
        sender,
        sender_ata,
        deposited_token_mint,
        stream_data,
        stream_data_ata,
        stream_nft,
        deposited_token_program,
    );
    let data = CancelInstructionData::new();

    // Capture data before ix execution
    let expected_refund_amount = get_refundable_amount(trident, &stream_data);
    let sender_ata_balance_before = get_ata_balance(trident, &sender_ata);
    let stream_data_ata_balance_before = get_ata_balance(trident, &stream_data_ata);

    // Execute the ix
    let ix = CancelInstruction::data(data).accounts(accounts.clone()).instruction();
    let result = trident.process_transaction(&[ix], Some("Cancel"));
    assert!(result.is_success(), "Cancel transaction failed");

    // Assert post-execution state
    assert_cancel(
        trident,
        &accounts,
        expected_refund_amount,
        sender_ata_balance_before,
        stream_data_ata_balance_before,
    );
}

fn assert_cancel(
    trident: &mut Trident,
    accounts: &CancelInstructionAccounts,
    expected_refund_amount: u64,
    sender_ata_balance_before: u64,
    stream_data_ata_balance_before: u64,
) {
    let stream_data = get_stream_data(trident, &accounts.stream_data);

    assert!(stream_data.was_canceled, "was_canceled must be true after cancel");
    assert!(!stream_data.is_cancelable, "is_cancelable must be false after cancel");

    // is_depleted: true when all tokens have been accounted for (withdrawn + refunded == deposited)
    let expected_depleted =
        stream_data.amounts.withdrawn + stream_data.amounts.refunded == stream_data.amounts.deposited;
    assert_eq!(stream_data.is_depleted, expected_depleted, "is_depleted mismatch after cancel");

    let actual_refund_amount = stream_data.amounts.refunded;
    assert!(actual_refund_amount == expected_refund_amount, "refunded amount does not match expected");

    // Verify stream_data_ata balance decreased by refund_amount
    let stream_data_ata_balance_after = get_ata_balance(trident, &accounts.stream_data_ata);
    assert_eq!(
        stream_data_ata_balance_before - stream_data_ata_balance_after,
        actual_refund_amount,
        "stream_data_ata balance must decrease by refunded amount"
    );

    // Verify sender_ata balance increased by refund_amount
    let sender_ata_balance_after = get_ata_balance(trident, &accounts.sender_ata);
    assert_eq!(
        sender_ata_balance_after - sender_ata_balance_before,
        actual_refund_amount,
        "sender_ata balance must increase by refunded amount"
    );

    check_universal_invariants(trident, &accounts.stream_data, &accounts.stream_data_ata);
}
