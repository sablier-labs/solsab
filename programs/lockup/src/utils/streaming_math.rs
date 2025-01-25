use anchor_lang::solana_program::sysvar::{clock::Clock, Sysvar};

use crate::state::lockup::Milestones;

pub fn get_streamed_amount(milestones: &Milestones, deposit_amount: u64) -> u64 {
    let current_time = Clock::get().unwrap().unix_timestamp;

    // If the start time is in the future, return zero.
    if milestones.start_time > current_time {
        return 0;
    }

    // If the end time is not in the future, return the deposited amount.
    if milestones.end_time <= current_time {
        return deposit_amount;
    }

    // If the cliff time is in the future, return zero.
    if milestones.cliff_time > current_time {
        return 0;
    }

    const SCALING_FACTOR: u128 = 1e18 as u128;

    // Calculate time variables. Scale to 18 decimals for increased precision and cast to u128 to prevent overflow.
    let elapsed_time = (current_time - milestones.start_time) as u128 * SCALING_FACTOR;
    let total_duration = (milestones.end_time - milestones.start_time) as u128;
    let elapsed_time_percentage = elapsed_time / total_duration;

    // Calculate the streamed amount by multiplying the elapsed time percentage and deposit amount.
    let streamed_amount = elapsed_time_percentage * (deposit_amount as u128);

    // Descale the streamed amount to the token's decimals. After dividing by SCALING_FACTOR, casting
    // down to u64 is safe.
    (streamed_amount / SCALING_FACTOR) as u64
}

pub fn get_withdrawable_amount(milestones: &Milestones, deposit_amount: u64, withdrawn_amount: u64) -> u64 {
    get_streamed_amount(milestones, deposit_amount) - withdrawn_amount
}

pub fn get_refundable_amount(milestones: &Milestones, deposit_amount: u64) -> u64 {
    deposit_amount - get_streamed_amount(milestones, deposit_amount)
}
