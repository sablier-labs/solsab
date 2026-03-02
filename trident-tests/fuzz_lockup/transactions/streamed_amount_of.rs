use crate::{helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

/// Executes StreamedAmountOf and asserts the return value matches the expected streamed amount.
pub fn streamed_amount_of(trident: &mut Trident, stream_data_pk: &Pubkey, stream_nft: &Pubkey) {
    // Execute the ix
    let actual = execute_streamed_amount_of(trident, stream_data_pk, stream_nft);

    // Assert post-execution state
    let expected = get_streamed_amount(trident, stream_data_pk);
    assert_eq!(actual, expected, "StreamedAmountOf return value mismatch: actual={actual}, expected={expected}");
}

/// Executes StreamedAmountOf and returns the on-chain return value without asserting.
pub fn execute_streamed_amount_of(trident: &mut Trident, stream_data_pk: &Pubkey, stream_nft: &Pubkey) -> u64 {
    // Prepare instruction accounts
    let accounts = StreamedAmountOfInstructionAccounts::new(*stream_data_pk, *stream_nft);
    let data = StreamedAmountOfInstructionData::new();

    // Execute the ix
    let ix = StreamedAmountOfInstruction::data(data).accounts(accounts).instruction();
    let result = trident.process_transaction(&[ix], Some("StreamedAmountOf"));
    assert!(result.is_success(), "StreamedAmountOf transaction failed");

    parse_return_data(&result.logs()).expect("Failed to get return data")
}
