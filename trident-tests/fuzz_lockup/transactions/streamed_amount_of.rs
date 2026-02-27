use crate::{helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

/// Executes StreamedAmountOf and asserts the return value matches the expected streamed amount.
pub fn streamed_amount_of(trident: &mut Trident, stream_data_pubkey: &Pubkey, stream_nft: &Pubkey) {
    let actual = execute_streamed_amount_of(trident, stream_data_pubkey, stream_nft);
    let expected = get_streamed_amount(trident, stream_data_pubkey);
    assert_eq!(actual, expected, "StreamedAmountOf return value mismatch: actual={actual}, expected={expected}");
}

/// Executes StreamedAmountOf and returns the on-chain return value without asserting.
pub fn execute_streamed_amount_of(trident: &mut Trident, stream_data_pubkey: &Pubkey, stream_nft: &Pubkey) -> u64 {
    let accounts = StreamedAmountOfInstructionAccounts::new(*stream_data_pubkey, *stream_nft);
    let data = StreamedAmountOfInstructionData::new();
    let ix = StreamedAmountOfInstruction::data(data).accounts(accounts).instruction();
    let result = trident.process_transaction(&[ix], Some("StreamedAmountOf"));
    assert!(result.is_success(), "StreamedAmountOf transaction failed");

    parse_return_data(&result.logs()).expect("Failed to get return data")
}
