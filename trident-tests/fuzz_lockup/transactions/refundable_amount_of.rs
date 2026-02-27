use crate::{helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn refundable_amount_of(trident: &mut Trident, stream_data_pubkey: &Pubkey, stream_nft: &Pubkey) {
    let accounts = RefundableAmountOfInstructionAccounts::new(*stream_data_pubkey, *stream_nft);
    let data = RefundableAmountOfInstructionData::new();
    let ix = RefundableAmountOfInstruction::data(data).accounts(accounts).instruction();
    let result = trident.process_transaction(&[ix], Some("RefundableAmountOf"));
    assert!(result.is_success(), "RefundableAmountOf transaction failed");

    let actual: u64 = parse_return_data(&result.logs()).expect("Failed to get return data");
    let expected = get_refundable_amount(trident, stream_data_pubkey);
    assert_eq!(actual, expected, "RefundableAmountOf return value mismatch: actual={actual}, expected={expected}");
}
