use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

use super::create_common::{assert_create, derive_create_accounts, mint_deposit_tokens};

pub fn create_with_durations_ll(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses) {
    let salt: u128 = trident.random_from_range(2..(u128::MAX - 1));

    let common = derive_create_accounts(trident, fuzz_accounts, salt);

    let data = get_data(trident, salt);

    mint_deposit_tokens(trident, &common, data.deposit_amount);
    let funder_ata_balance_before = get_ata_balance(trident, &common.funder_ata);

    let accounts = CreateWithDurationsLlInstructionAccounts::new(
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

    // Execute the ix
    let ix = CreateWithDurationsLlInstruction::data(data.clone()).accounts(accounts).instruction();
    let result = trident.process_transaction(&[ix], Some("CreateWithDurationsLL"));
    assert!(result.is_success(), "CreateWithDurationsLL transaction failed");

    // Assert post-execution state
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

    let (start_time, cliff_time, end_time, _, _) = get_linear_params(&stream_data);
    let now = trident.get_current_timestamp() as u64;
    assert!(now - start_time <= 1, "start_time must be within 1 second of now");
    if data.cliff_duration > 0 {
        assert_eq!(cliff_time - start_time, data.cliff_duration, "cliff_duration mismatch");
    } else {
        assert_eq!(cliff_time, 0, "cliff_time must be 0 when no cliff");
    }
    assert_eq!(end_time - start_time, data.total_duration, "total_duration mismatch");
}

fn get_data(trident: &mut Trident, salt: u128) -> CreateWithDurationsLlInstructionData {
    let deposit_amount = trident.random_from_range(1..1_000_000_000 * DECIMALS_MULTIPLIER);

    const MAX_TOTAL_DURATION: u64 = 1_000_000;
    let random_cliff_selector = trident.random_from_range(1..10);
    let (cliff_duration, total_duration) = match random_cliff_selector {
        1 => {
            let total = trident.random_from_range(1..MAX_TOTAL_DURATION);
            (0, total)
        }
        _ => {
            let cliff = trident.random_from_range(1..100_000);
            let total = trident.random_from_range(cliff + 1..MAX_TOTAL_DURATION);
            (cliff, total)
        }
    };

    let start_amount = trident.random_from_range(0..deposit_amount);
    let cliff_amount = match cliff_duration {
        0 => 0,
        _ => trident.random_from_range(0..deposit_amount - start_amount),
    };

    let cancelable = trident.random_bool();

    CreateWithDurationsLlInstructionData::new(
        salt,
        deposit_amount,
        cliff_duration,
        total_duration,
        start_amount,
        cliff_amount,
        cancelable,
    )
}
