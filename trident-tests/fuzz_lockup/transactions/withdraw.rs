use crate::{fuzz_accounts::FuzzAccounts, helpers::*, instructions::*, invariants::*, withdrawal_assertions::*};
use std::cell::RefCell;
use trident_fuzz::fuzzing::*;

// Thread-local static storage for the expected withdrawn amount
thread_local! {
    static EXPECTED_WITHDRAWN_AMOUNT: RefCell<Option<u64>> = const { RefCell::new(None) };
}

/// Customize transaction behavior by adding more instructions.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-advanced/trident-transactions/multi-instruction-transactions/
#[derive(Debug, TridentTransaction, Default)]
pub struct WithdrawTransaction {
    pub instruction: WithdrawInstruction,
}

/// Methods for customizing transaction behavior:
/// - `pre_transaction`: Execute custom logic before transaction execution
/// - `transaction_invariant_check`: Validate transaction-specific invariants
/// - `transaction_error_handler`: Custom handling of transaction errors
/// - `post_transaction`: Execute custom logic after transaction execution
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-advanced/trident-transactions/transaction-methods/
impl TransactionHooks for WithdrawTransaction {
    type IxAccounts = FuzzAccounts;

    fn pre_transaction(&self, _client: &mut impl FuzzClient) {
        // Store the requested withdrawal amount for later use
        let expected_withdrawn_amount = self.instruction.data.amount;
        EXPECTED_WITHDRAWN_AMOUNT.with(|cell| {
            *cell.borrow_mut() = Some(expected_withdrawn_amount);
        });
    }

    fn post_transaction(&self, client: &mut impl FuzzClient) {
        // Get the expected withdrawn amount
        let expected_withdrawn_amount =
            EXPECTED_WITHDRAWN_AMOUNT.with(|cell| cell.borrow().expect("EXPECTED_WITHDRAWN_AMOUNT unavailable"));

        // Get the stream data after the transaction
        let stream_data = get_stream_data_from_client(client, &self.instruction.accounts.stream_data.pubkey());

        // Assert that the stream data has been updated correctly
        assert_withdrawal(
            client,
            &stream_data,
            &self.instruction.accounts.stream_data_ata,
            &self.instruction.accounts.withdrawal_recipient_ata,
            expected_withdrawn_amount,
            stream_data.amounts.withdrawn,
        );

        // Check the tx invariants
        check_invariants(&self.instruction.accounts, get_current_time_from_client(client));
    }
}

fn check_invariants(accounts: &WithdrawInstructionAccounts, current_time: u64) {
    // Assert universal invariants using real-time data
    check_universal_invariants(&accounts.stream_data, &accounts.stream_data_ata, current_time);
}
