use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn create_with_durations_ll(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses) {
    let salt: u128 = trident.random_from_range(2..(u128::MAX - 1));

    // Resolve all accounts
    let accounts = CreateStreamAccounts::resolve(trident, fuzz_accounts, salt);

    // Build instruction data
    let data = get_data(trident, salt);

    // Mint tokens to creator's ATA
    let mint_ix = trident.mint_to(&accounts.creator_ata, &accounts.deposit_token_mint, &accounts.creator, data.deposit_amount);
    let mint_result = trident.process_transaction(&[mint_ix], None);
    assert!(mint_result.is_success(), "Failed to mint {} tokens to creator ATA", data.deposit_amount);

    // Execute instruction
    let ix = CreateWithDurationsLlInstruction::data(data.clone())
        .accounts(accounts.to_durations_accounts())
        .instruction();
    let result = trident.process_transaction(&[ix], Some("CreateWithDurationsLL"));
    assert!(result.is_success(), "CreateWithDurationsLL transaction failed");

    // Run assertions
    assertions(trident, &accounts, &data);
}

fn get_data(trident: &mut Trident, salt: u128) -> CreateWithDurationsLlInstructionData {
    let deposit_amount = trident.random_from_range(1..1_000_000_000 * DECIMALS_MULTIPLIER);

    let (cliff_duration, total_duration) = if trident.random_from_range(1..10) == 1 {
        (0, trident.random_from_range(1..1_000_000))
    } else {
        let cliff = trident.random_from_range(1..100_000);
        (cliff, trident.random_from_range(cliff + 1..cliff + 1_000_000))
    };

    let start_amount = trident.random_from_range(0..deposit_amount);
    let cliff_amount = if cliff_duration > 0 { trident.random_from_range(0..deposit_amount - start_amount) } else { 0 };

    CreateWithDurationsLlInstructionData::new(
        salt, deposit_amount, cliff_duration, total_duration, start_amount, cliff_amount, trident.random_bool(),
    )
}

fn assertions(trident: &mut Trident, accounts: &CreateStreamAccounts, data: &CreateWithDurationsLlInstructionData) {
    let expected = CreateExpected {
        salt: data.salt,
        deposit_amount: data.deposit_amount,
        start_unlock_amount: data.start_unlock_amount,
        cliff_unlock_amount: data.cliff_unlock_amount,
        is_cancelable: data.is_cancelable,
    };

    assert_stream_accounts_created(trident, accounts);
    assert_stream_data_fields(trident, accounts, &expected);
    assert_stream_token_balances(trident, accounts, data.deposit_amount);

    // Duration-specific assertions
    let stream_data = get_stream_data(trident, &accounts.stream_data);
    if data.cliff_duration > 0 {
        assert_eq!(stream_data.timestamps.cliff - stream_data.timestamps.start, data.cliff_duration, "cliff_duration mismatch");
    } else {
        assert_eq!(stream_data.timestamps.cliff, 0, "cliff_time should be 0 when no cliff");
    }
    assert_eq!(stream_data.timestamps.end - stream_data.timestamps.start, data.total_duration, "total_duration mismatch");
}
