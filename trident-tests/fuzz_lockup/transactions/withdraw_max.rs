use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

use super::withdraw_common::{assert_withdraw, setup_withdraw_accounts};

pub fn withdraw_max(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses, withdraw_to_recipient: bool) {
    let (common, recipient_ata_balance_before, stream_data_ata_balance_before) =
        setup_withdraw_accounts(trident, fuzz_accounts, withdraw_to_recipient);

    let withdrawable_amount = get_withdrawable_amount(trident, &common.stream_data);

    let accounts = WithdrawMaxInstructionAccounts::new(
        common.signer,
        common.withdrawal_recipient,
        common.withdrawal_recipient_ata,
        common.treasury,
        common.deposited_token_mint,
        common.stream_data,
        common.stream_data_ata,
        common.stream_nft,
        common.chainlink_program,
        common.chainlink_sol_usd_feed,
        common.deposited_token_program,
    );

    let data = WithdrawMaxInstructionData::new();

    // Execute the ix
    let ix = WithdrawMaxInstruction::data(data).accounts(accounts).instruction();
    let result = trident.process_transaction(&[ix], Some("WithdrawMax"));
    assert!(result.is_success(), "WithdrawMax transaction failed");

    // Assert post-execution state
    assert_withdraw(trident, &common, withdrawable_amount, recipient_ata_balance_before, stream_data_ata_balance_before);
}
