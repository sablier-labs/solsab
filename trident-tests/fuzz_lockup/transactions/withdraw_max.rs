use borsh::BorshDeserialize;
use std::cell::RefCell;
use trident_fuzz::fuzzing::*;

use crate::{
    fuzz_accounts::FuzzAccounts, get_current_time_from_client, get_stream_data_from_client, get_withdrawable_amount,
    instructions::*, invariants::*, types::StreamData, withdrawal_assertions::*,
};
// Thread-local static storage for the expected withdrawn amount
thread_local! {
    static EXPECTED_WITHDRAWN_AMOUNT: RefCell<Option<u64>> = const { RefCell::new(None) };
}

/// Customize transaction behavior by adding more instructions.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-advanced/trident-transactions/multi-instruction-transactions/
#[derive(Debug, TridentTransaction, Default)]
pub struct WithdrawMaxTransaction {
    pub instruction: WithdrawMaxInstruction,
}

/// Methods for customizing transaction behavior:
/// - `pre_transaction`: Execute custom logic before transaction execution
/// - `transaction_invariant_check`: Validate transaction-specific invariants
/// - `transaction_error_handler`: Custom handling of transaction errors
/// - `post_transaction`: Execute custom logic after transaction execution
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-advanced/trident-transactions/transaction-methods/
impl TransactionHooks for WithdrawMaxTransaction {
    type IxAccounts = FuzzAccounts;

    fn pre_transaction(&self, client: &mut impl FuzzClient) {
        // Get the pre-transaction stream data from the snapshot
        let stream_data_snapshot = self.instruction.accounts.stream_data.get_snapshot_before().data();
        let stream_data = StreamData::try_from_slice(&stream_data_snapshot[8..])
            .expect("Failed to deserialize the pre-tx StreamData");

        // Calculate the expected withdrawn amount
        let current_time = get_current_time_from_client(client);
        let withdrawable_amount = get_withdrawable_amount(
            &stream_data.timestamps,
            &stream_data.amounts,
            stream_data.is_depleted,
            stream_data.was_canceled,
            current_time,
        );

        // Store the expected withdrawn amount in thread-local storage
        EXPECTED_WITHDRAWN_AMOUNT.with(|cell| {
            *cell.borrow_mut() = Some(withdrawable_amount);
        });
    }

    fn post_transaction(&self, client: &mut impl FuzzClient) {
        // Get the expected withdrawn amount that was calculated in pre_transaction
        let expected_withdrawn_amount =
            EXPECTED_WITHDRAWN_AMOUNT.with(|cell| cell.borrow().expect("EXPECTED_WITHDRAWN_AMOUNT unavailable"));

        // Get the stream data after the transaction
        let stream_data = get_stream_data_from_client(client, &self.instruction.accounts.stream_data.pubkey());

        assert_withdrawal(
            client,
            &stream_data,
            &self.instruction.accounts.stream_data_ata,
            &self.instruction.accounts.withdrawal_recipient_ata,
            expected_withdrawn_amount,
            expected_withdrawn_amount,
        );

        // Check the tx invariants
        check_invariants(&self.instruction.accounts, get_current_time_from_client(client));
    }
}

fn check_invariants(accounts: &WithdrawMaxInstructionAccounts, current_time: u64) {
    // Assert universal invariants using real-time data
    check_universal_invariants(&accounts.stream_data, &accounts.stream_data_ata, current_time);
}
