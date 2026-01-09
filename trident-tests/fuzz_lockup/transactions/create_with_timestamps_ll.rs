use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn create_with_timestamps_ll(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses, is_default_stream: bool) {
    let salt: u128 = if is_default_stream { 1 } else { trident.random_from_range(2..(u128::MAX - 1)) };

    // Resolve all accounts
    let accounts = CreateStreamAccounts::resolve(trident, fuzz_accounts, salt);

    // Build instruction data
    let data = get_data(trident, salt, is_default_stream);

    // Mint tokens to creator's ATA
    let mint_ix = trident.mint_to(&accounts.creator_ata, &accounts.deposit_token_mint, &accounts.creator, data.deposit_amount);
    let mint_result = trident.process_transaction(&[mint_ix], None);
    assert!(mint_result.is_success(), "Failed to mint {} tokens to creator ATA", data.deposit_amount);

    // Execute instruction
    let ix = CreateWithTimestampsLlInstruction::data(data.clone())
        .accounts(accounts.to_timestamps_accounts())
        .instruction();
    let result = trident.process_transaction(&[ix], Some("CreateWithTimestampsLL"));
    assert!(result.is_success(), "CreateWithTimestampsLL transaction failed");

    // Run assertions
    assertions(trident, &accounts, &data);
}

fn get_data(trident: &mut Trident, salt: u128, is_default_stream: bool) -> CreateWithTimestampsLlInstructionData {
    if is_default_stream {
        return CreateWithTimestampsLlInstructionData::new(
            salt, DEPOSIT_AMOUNT, START_TIME, CLIFF_TIME, END_TIME, START_AMOUNT, CLIFF_AMOUNT, true,
        );
    }

    let deposit_amount = trident.random_from_range(1..1_000_000_000 * DECIMALS_MULTIPLIER);
    let start_time = trident.random_from_range(START_TIME..START_TIME + 10_000);

    let (cliff_time, end_time) = if trident.random_from_range(1..10) == 1 {
        (0, trident.random_from_range(start_time + 1..start_time + 1_000_000))
    } else {
        let cliff = trident.random_from_range(start_time + 1..start_time + 100_000);
        (cliff, trident.random_from_range(cliff + 1..cliff + 1_000_000))
    };

    let start_amount = trident.random_from_range(0..deposit_amount);
    let cliff_amount = if cliff_time > 0 { trident.random_from_range(0..deposit_amount - start_amount) } else { 0 };

    CreateWithTimestampsLlInstructionData::new(
        salt, deposit_amount, start_time, cliff_time, end_time, start_amount, cliff_amount, trident.random_bool(),
    )
}

fn assertions(trident: &mut Trident, accounts: &CreateStreamAccounts, data: &CreateWithTimestampsLlInstructionData) {
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

    // Timestamp-specific assertions
    let stream_data = get_stream_data(trident, &accounts.stream_data);
    assert_eq!(stream_data.timestamps.start, data.start_time, "start_time mismatch");
    assert_eq!(stream_data.timestamps.cliff, data.cliff_time, "cliff_time mismatch");
    assert_eq!(stream_data.timestamps.end, data.end_time, "end_time mismatch");
}
