use anchor_lang::solana_program::sysvar::{clock::Clock, Sysvar};

use crate::state::lockup_stream::Milestones;

pub fn get_streamed_amount(milestones: Milestones, deposit_amount: u64) -> u64 {
    let current_time = Clock::get().unwrap().unix_timestamp;

    // If the start time is in the future, return zero.
    if milestones.start_time > current_time {
        return 0;
    }

    // If the end time is not in the future, return the deposited amount.
    if milestones.end_time <= current_time {
        return 0;
    }

    // If the cliff time is in the future, return zero.
    if milestones.cliff_time > current_time {
        return 0;
    }

    // Calculate the streamed amount
    let elapsed_time = current_time - milestones.start_time;
    let total_duration = milestones.end_time - milestones.start_time;

    // Dev: The following cast is safe because we're up-casting the amounts (u64 -> u128), while the elapsed_time is
    // always less than the total_duration
    (deposit_amount as u128 * elapsed_time as u128 / total_duration as u128) as u64
}

pub fn get_withdrawable_amount(milestones: Milestones, deposit_amount: u64, withdrawn_amount: u64) -> u64 {
    get_streamed_amount(milestones, deposit_amount) - withdrawn_amount
}

pub fn get_refundable_amount(milestones: Milestones, deposit_amount: u64) -> u64 {
    deposit_amount - get_streamed_amount(milestones, deposit_amount)
}
