use anchor_lang::solana_program::sysvar::{clock::Clock, Sysvar};

use crate::state::lockup::{Amounts, Timestamps};

pub fn get_streamed_amount(timestamps: &Timestamps, amounts: &Amounts) -> u64 {
    let now = Clock::get().unwrap().unix_timestamp;

    // If the start time is in the future, return zero.
    if timestamps.start_time > now {
        return 0;
    }

    // If the cliff time is in the future, return the start unlock amount.
    if timestamps.cliff_time > now {
        return amounts.start_unlock;
    }

    // If the end time is in the past or right now, return the deposited amount.
    if timestamps.end_time <= now {
        return amounts.deposited;
    }

    // Calculate the sum of the unlock amounts.
    let unlock_amounts_sum = amounts.start_unlock + amounts.cliff_unlock;

    //  If the sum of the unlock amounts is greater than or equal to the deposited amount, return the deposited
    // amount. The ">=" operator is used as a safety measure in case of a bug, as the sum of the unlock amounts
    // should never exceed the deposited amount.
    if unlock_amounts_sum >= amounts.deposited {
        return amounts.deposited;
    }

    // Determine the streaming start time.
    let streaming_start_time = if amounts.cliff_unlock == 0 { timestamps.start_time } else { timestamps.cliff_time };

    const SCALING_FACTOR: u128 = 1e18 as u128;

    // Calculate time variables. Scale to 18 decimals for increased precision and cast to u128 to prevent overflow.
    let elapsed_time = (now - streaming_start_time) as u128 * SCALING_FACTOR;
    let streamable_time_range = (timestamps.end_time - streaming_start_time) as u128;
    let streamed_percentage = elapsed_time / streamable_time_range;

    // Calculate the streamable amount.
    let streamable_amount = (amounts.deposited - unlock_amounts_sum) as u128;

    // Calculate the streamed amount. After dividing by SCALING_FACTOR, casting down to u64 is safe.
    let streamed_amount = unlock_amounts_sum + ((streamed_percentage * streamable_amount) / SCALING_FACTOR) as u64;

    // Although the streamed amount should never exceed the deposited amount, this condition is checked
    // without asserting to avoid locking assets in case of a bug. If this situation occurs, the withdrawn
    // amount is considered to be the streamed amount, and the stream is effectively frozen.
    if streamed_amount > amounts.deposited {
        return amounts.deposited;
    }

    streamed_amount
}

pub fn get_withdrawable_amount(timestamps: &Timestamps, amounts: &Amounts) -> u64 {
    get_streamed_amount(timestamps, amounts) - amounts.withdrawn
}

pub fn get_refundable_amount(timestamps: &Timestamps, amounts: &Amounts) -> u64 {
    amounts.deposited - get_streamed_amount(timestamps, amounts)
}
