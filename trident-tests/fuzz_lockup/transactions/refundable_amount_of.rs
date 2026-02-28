use crate::{helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn refundable_amount_of(trident: &mut Trident, stream_data_pk: &Pubkey, stream_nft: &Pubkey) {
    // Prepare instruction accounts
    let accounts = RefundableAmountOfInstructionAccounts::new(*stream_data_pk, *stream_nft);
    let data = RefundableAmountOfInstructionData::new();

    // Execute the ix
    let ix = RefundableAmountOfInstruction::data(data).accounts(accounts).instruction();
    let result = trident.process_transaction(&[ix], Some("RefundableAmountOf"));
    assert!(result.is_success(), "RefundableAmountOf transaction failed");

    // Assert post-execution state
    let actual: u64 = parse_return_data(&result.logs()).expect("Failed to get return data");
    let expected = get_refundable_amount(trident, stream_data_pk);
    assert_eq!(actual, expected, "RefundableAmountOf return value mismatch: actual={actual}, expected={expected}");
}
