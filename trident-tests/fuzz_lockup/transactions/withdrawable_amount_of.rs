use crate::{helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn withdrawable_amount_of(trident: &mut Trident, stream_data_pubkey: &Pubkey, stream_nft: &Pubkey) {
    let accounts = WithdrawableAmountOfInstructionAccounts::new(*stream_data_pubkey, *stream_nft);
    let data = WithdrawableAmountOfInstructionData::new();
    let ix = WithdrawableAmountOfInstruction::data(data).accounts(accounts).instruction();
    let result = trident.process_transaction(&[ix], Some("WithdrawableAmountOf"));
    assert!(result.is_success(), "WithdrawableAmountOf transaction failed");

    let actual: u64 = parse_return_data(&result.logs()).expect("Failed to get return data");
    let expected = get_withdrawable_amount(trident, stream_data_pubkey);
    assert_eq!(actual, expected, "WithdrawableAmountOf return value mismatch: actual={actual}, expected={expected}");
}
