use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

use super::create_common::{assert_create, derive_create_accounts, mint_deposit_tokens};

pub fn create_with_timestamps_ll(
    trident: &mut Trident,
    fuzz_accounts: &mut AccountAddresses,
    use_default_stream: bool,
) {
    let salt: u128 = if use_default_stream {
        1
    } else {
        trident.random_from_range(2..(u128::MAX - 1))
    };

    let common = derive_create_accounts(trident, fuzz_accounts, salt);

    let data = get_data(trident, salt, use_default_stream);

    mint_deposit_tokens(trident, &common, data.deposit_amount);
    let funder_ata_balance_before = get_ata_token_balance(trident, &common.funder_ata);

    let accounts = CreateWithTimestampsLlInstructionAccounts::new(
        common.funder,
        common.funder_ata,
        common.recipient,
        common.sender,
        common.treasury,
        common.stream_nft_collection,
        common.deposit_token_mint,
        common.stream_data,
        common.stream_data_ata,
        common.stream_nft,
        common.deposit_token_program,
    );

    let ix = CreateWithTimestampsLlInstruction::data(data.clone()).accounts(accounts).instruction();
    let result = trident.process_transaction(&[ix], Some("CreateWithTimestampsLL"));
    assert!(result.is_success(), "CreateWithTimestampsLL transaction failed");

    // Shared assertions
    let stream_data = assert_create(
        trident,
        &common,
        data.deposit_amount,
        data.start_unlock_amount,
        data.cliff_unlock_amount,
        data.salt,
        data.is_cancelable,
        funder_ata_balance_before,
    );

    // Timestamp-specific assertions
    let (start, cliff, end, _, _) = get_linear_params(&stream_data);
    assert_eq!(start, data.start_time, "start_time mismatch");
    assert_eq!(cliff, data.cliff_time, "cliff_time mismatch");
    assert_eq!(end, data.end_time, "end_time mismatch");
}

fn get_data(trident: &mut Trident, salt: u128, use_default_stream: bool) -> CreateWithTimestampsLlInstructionData {
    if use_default_stream {
        return CreateWithTimestampsLlInstructionData::new(
            salt,
            DEPOSIT_AMOUNT,
            START_TIME,
            CLIFF_TIME,
            END_TIME,
            START_AMOUNT,
            CLIFF_AMOUNT,
            true,
        );
    }

    let deposit_amount = trident.random_from_range(1..1_000_000_000 * DECIMALS_MULTIPLIER);

    let start_time = trident.random_from_range(START_TIME..START_TIME + 10_000);

    let random_cliff_selector = trident.random_from_range(1..10);
    let (cliff_time, end_time) = if random_cliff_selector == 1 {
        let end = trident.random_from_range(start_time + 1..start_time + 1_000_000);
        (0, end)
    } else {
        let cliff = trident.random_from_range(start_time + 1..start_time + 100_000);
        let end = trident.random_from_range(cliff + 1..cliff + 1_000_000);
        (cliff, end)
    };

    let start_amount = trident.random_from_range(0..deposit_amount);
    let cliff_amount = if cliff_time > 0 {
        trident.random_from_range(0..deposit_amount - start_amount)
    } else {
        0
    };

    let cancelable = trident.random_bool();

    CreateWithTimestampsLlInstructionData::new(
        salt,
        deposit_amount,
        start_time,
        cliff_time,
        end_time,
        start_amount,
        cliff_amount,
        cancelable,
    )
}
