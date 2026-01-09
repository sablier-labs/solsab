use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn withdraw(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses, withdraw_to_recipient: bool, amount: u64) {
    // Resolve all accounts
    let accounts = WithdrawalAccounts::resolve(trident, fuzz_accounts, withdraw_to_recipient);

    // Capture balances before withdraw
    let recipient_ata_balance_before = get_ata_token_balance(trident, &accounts.withdrawal_recipient_ata);
    let stream_data_ata_balance_before = get_ata_token_balance(trident, &accounts.stream_data_ata);

    // Execute instruction
    let data = WithdrawInstructionData::new(amount);
    let ix = WithdrawInstruction::data(data).accounts(accounts.to_withdraw_accounts()).instruction();
    let result = trident.process_transaction(&[ix], Some("Withdraw"));
    assert!(result.is_success(), "Withdraw transaction failed");

    // Run assertions
    assert_withdrawal(trident, &accounts, amount, recipient_ata_balance_before, stream_data_ata_balance_before);
}
