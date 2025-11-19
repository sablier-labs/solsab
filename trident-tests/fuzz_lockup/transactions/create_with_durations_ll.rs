use crate::{
    fuzz_accounts::FuzzAccounts, get_current_time_from_client, instructions::*, invariants::*,
    stream_creation_assertions::StreamCreationAssertions,
};
use trident_fuzz::fuzzing::*;

/// Customize transaction behavior by adding more instructions.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-advanced/trident-transactions/multi-instruction-transactions/
#[derive(Debug, TridentTransaction, Default)]
pub struct CreateWithDurationsLlTransaction {
    pub instruction: CreateWithDurationsLlInstruction,
}

/// Methods for customizing transaction behavior:
/// - `pre_transaction`: Execute custom logic before transaction execution
/// - `transaction_invariant_check`: Validate transaction-specific invariants
/// - `transaction_error_handler`: Custom handling of transaction errors
/// - `post_transaction`: Execute custom logic after transaction execution
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-advanced/trident-transactions/transaction-methods/
impl TransactionHooks for CreateWithDurationsLlTransaction {
    type IxAccounts = FuzzAccounts;

    fn post_transaction(&self, client: &mut impl FuzzClient) {
        // Assert that the stream creation has been successful
        StreamCreationAssertions::assert_create_with_durations(
            client,
            &self.instruction.accounts,
            &self.instruction.data,
        );

        // Check the tx invariants
        check_invariants(client, &self.instruction.accounts);
    }
}

fn check_invariants(client: &mut impl FuzzClient, accounts: &CreateWithDurationsLlInstructionAccounts) {
    // Create-specific invariants
    check_create_invariants(&accounts.creator_ata, &accounts.stream_data_ata);

    // Assert universal invariants using real-time data
    check_universal_invariants(&accounts.stream_data, &accounts.stream_data_ata, get_current_time_from_client(client));
}
