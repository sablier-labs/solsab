use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn withdraw_max(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses, withdraw_to_recipient: bool) {
    // Resolve all accounts
    let accounts = WithdrawalAccounts::resolve(trident, fuzz_accounts, withdraw_to_recipient);

    // Capture balances before withdraw
    let recipient_ata_balance_before = get_ata_token_balance(trident, &accounts.withdrawal_recipient_ata);
    let stream_data_ata_balance_before = get_ata_token_balance(trident, &accounts.stream_data_ata);
    let withdrawable_amount = get_withdrawable_amount(trident, &accounts.stream_data);

    // Execute instruction
    let data = WithdrawMaxInstructionData::new();
    let ix = WithdrawMaxInstruction::data(data).accounts(accounts.to_withdraw_max_accounts()).instruction();
    let result = trident.process_transaction(&[ix], Some("WithdrawMax"));
    assert!(result.is_success(), "WithdrawMax transaction failed");

    // Run assertions
    assert_withdrawal(trident, &accounts, withdrawable_amount, recipient_ata_balance_before, stream_data_ata_balance_before);
}
