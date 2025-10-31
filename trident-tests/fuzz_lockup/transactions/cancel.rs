use borsh::BorshDeserialize;
use std::cell::RefCell;
use trident_fuzz::fuzzing::*;

use crate::{
    fuzz_accounts::FuzzAccounts, get_current_time_from_client, get_refundable_amount, get_spl_ata_balance_from_data,
    get_spl_ata_balance_via_client, get_stream_data_from_client, instructions::*, invariants::*, types::StreamData,
};
// Thread-local static storage for the expected refund amount
thread_local! {
    static EXPECTED_REFUNDED_AMOUNT: RefCell<Option<u64>> = const { RefCell::new(None) };
}

/// Customize transaction behavior by adding more instructions.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-advanced/trident-transactions/multi-instruction-transactions/
#[derive(Debug, TridentTransaction, Default)]
pub struct CancelTransaction {
    pub instruction: CancelInstruction,
}

/// Methods for customizing transaction behavior:
/// - `pre_transaction`: Execute custom logic before transaction execution
/// - `transaction_invariant_check`: Validate transaction-specific invariants
/// - `transaction_error_handler`: Custom handling of transaction errors
/// - `post_transaction`: Execute custom logic after transaction execution
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-advanced/trident-transactions/transaction-methods/
impl TransactionHooks for CancelTransaction {
    type IxAccounts = FuzzAccounts;

    fn pre_transaction(&self, client: &mut impl FuzzClient) {
        // Get the pre-transaction stream data from the snapshot
        let stream_data_snapshot = self.instruction.accounts.stream_data.get_snapshot_before().data();
        let stream_data = StreamData::try_from_slice(&stream_data_snapshot[8..])
            .expect("Failed to deserialize the pre-tx StreamData");

        // Calculate the expected refund amount using the same logic as the program
        let current_time = get_current_time_from_client(client);
        let refundable_amount = get_refundable_amount(
            &stream_data.timestamps,
            &stream_data.amounts,
            stream_data.is_cancelable,
            stream_data.is_depleted,
            stream_data.was_canceled,
            current_time,
        );

        // Store the expected refunded amount in the static storage
        EXPECTED_REFUNDED_AMOUNT.with(|cell| {
            *cell.borrow_mut() = Some(refundable_amount);
        });
    }

    fn post_transaction(&self, client: &mut impl FuzzClient) {
        // Get the expected refund amount that was calculated in pre_transaction
        let expected_refunded_amount =
            EXPECTED_REFUNDED_AMOUNT.with(|cell| cell.borrow().expect("EXPECTED_REFUNDED_AMOUNT unavailable"));

        // Get the stream data after the transaction
        let stream_data = get_stream_data_from_client(client, &self.instruction.accounts.stream_data.pubkey());

        // Assert that the refundable amount is 0
        let refundable_amount = get_refundable_amount(
            &stream_data.timestamps,
            &stream_data.amounts,
            stream_data.is_cancelable,
            stream_data.is_depleted,
            stream_data.was_canceled,
            get_current_time_from_client(client),
        );
        assert_eq!(refundable_amount, 0, "Refundable amount must be 0 after cancellation");

        // Assert stream data has been updated correctly
        assert_stream_data_state_post_tx(&stream_data, expected_refunded_amount);

        // Assert token balance changes
        assert_token_balance_changes_post_tx(client, &self.instruction.accounts, expected_refunded_amount);

        // Check the tx invariants
        check_invariants(client, &self.instruction.accounts, expected_refunded_amount);
    }
}

fn check_invariants(client: &mut impl FuzzClient, accounts: &CancelInstructionAccounts, expected_refunded_amount: u64) {
    // Cancel-specific invariants
    // Invariant: refunded amount > 0
    assert!(expected_refunded_amount > 0, "Refunded amount must be greater than 0 after cancellation");

    let stream_data_ata = &accounts.stream_data_ata;

    // Invariant: token balance changes are correct
    let stream_data_balance_before = get_spl_ata_balance_from_data(stream_data_ata.get_snapshot_before().data());
    let sender_balance_before = get_spl_ata_balance_from_data(accounts.sender_ata.get_snapshot_before().data());
    let stream_data_balance_after = get_spl_ata_balance_via_client(client, &stream_data_ata.pubkey());
    let sender_balance_after = get_spl_ata_balance_via_client(client, &accounts.sender_ata.pubkey());

    // Stream data's token balance should have decreased by the refunded amount
    assert_eq!(
        stream_data_balance_after,
        stream_data_balance_before.saturating_sub(expected_refunded_amount),
        "Stream data's token balance should have decreased by the refunded amount"
    );

    // Sender's token balance should have increased by the refunded amount
    assert_eq!(
        sender_balance_after,
        sender_balance_before.saturating_add(expected_refunded_amount),
        "Sender's token balance should have increased by the refunded amount"
    );

    // Assert universal invariants
    check_universal_invariants(&accounts.stream_data, stream_data_ata, get_current_time_from_client(client));
}

/// Assert that the stream data has been updated correctly after cancellation
fn assert_stream_data_state_post_tx(stream_data_post: &StreamData, expected_refund_amount: u64) {
    // Assert that the stream was marked as canceled
    assert!(stream_data_post.was_canceled, "Stream should be marked as canceled");

    // Assert that the stream is no longer cancelable
    assert!(!stream_data_post.is_cancelable, "Stream should not be cancelable after cancellation");

    // Assert that the refunded amount has been updated correctly
    assert_eq!(
        stream_data_post.amounts.refunded, expected_refund_amount,
        "Stream refunded amount should match the expected refund amount"
    );

    // If the stream has been depleted (i.e. when cancelled before start time), assert that is has been marked as such
    if expected_refund_amount == stream_data_post.amounts.deposited {
        assert!(stream_data_post.is_depleted, "Stream should be depleted");
    }
}

/// Assert token balance changes for a cancellation
fn assert_token_balance_changes_post_tx(
    client: &mut impl FuzzClient,
    accounts: &CancelInstructionAccounts,
    expected_refund_amount: u64,
) {
    // Get snapshot data from the accounts
    let stream_data_ata_before = accounts.stream_data_ata.get_snapshot_before().data();
    let sender_ata_before = accounts.sender_ata.get_snapshot_before().data();

    // Check that the stream data ATA balance has decreased by the refunded amount
    let stream_data_ata_balance_after = get_spl_ata_balance_via_client(client, &accounts.stream_data_ata.pubkey());
    let expected_stream_data_balance = get_spl_ata_balance_from_data(stream_data_ata_before) - expected_refund_amount;
    assert_eq!(
        stream_data_ata_balance_after, expected_stream_data_balance,
        "Stream data ATA balance should have decreased by the refunded amount"
    );

    // Check that the sender's token balance has increased by the refunded amount
    let sender_ata_balance_after = get_spl_ata_balance_via_client(client, &accounts.sender_ata.pubkey());
    let expected_sender_ata_balance = get_spl_ata_balance_from_data(sender_ata_before) + expected_refund_amount;
    assert_eq!(
        sender_ata_balance_after, expected_sender_ata_balance,
        "Sender ATA balance should have increased by the refunded amount"
    );
}
