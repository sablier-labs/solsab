use crate::{
    state::lockup::{Amounts, Timestamps},
    utils::get_current_time,
};

pub fn get_streamed_amount(timestamps: &Timestamps, amounts: &Amounts, is_depleted: bool, was_canceled: bool) -> u64 {
    if is_depleted {
        return amounts.withdrawn;
    } else if was_canceled {
        return amounts.deposited - amounts.refunded;
    }

    let now = get_current_time().unwrap();

    // If the start time is in the future, return zero.
    if timestamps.start > now {
        return 0;
    }

    // If the cliff time is in the future, return the start unlock amount.
    if timestamps.cliff > now {
        return amounts.start_unlock;
    }

    // If the end time is in the past or right now, return the deposited amount.
    if timestamps.end <= now {
        return amounts.deposited;
    }

    // Calculate the sum of the unlock amounts.
    let unlock_amounts_sum: u64 = amounts.start_unlock + amounts.cliff_unlock;

    // If the sum of the unlock amounts is greater than or equal to the deposited amount, return the deposited
    // amount. The ">=" operator is used as a safety measure in case of a bug, as the sum of the unlock amounts
    // should never exceed the deposited amount.
    if unlock_amounts_sum >= amounts.deposited {
        return amounts.deposited;
    }

    // Determine the streaming start time.
    let streaming_start_time = if timestamps.cliff == 0 {
        timestamps.start
    } else {
        timestamps.cliff
    };

    const SCALING_FACTOR: u128 = 1e18 as u128;

    // Calculate time variables. Scale to 18 decimals for increased precision and cast to u128 to prevent overflow.
    let elapsed_time = (now - streaming_start_time) as u128 * SCALING_FACTOR;
    let streamable_range = (timestamps.end - streaming_start_time) as u128;
    let elapsed_time_percentage = elapsed_time / streamable_range;

    // Calculate the streamable amount.
    let streamable_amount = (amounts.deposited - unlock_amounts_sum) as u128;

    // Calculate the streamed amount. After dividing by the scaling factor, casting down to u64 is safe.
    let streamed_amount = unlock_amounts_sum + ((elapsed_time_percentage * streamable_amount) / SCALING_FACTOR) as u64;

    // Although the streamed amount should never exceed the deposited amount, this condition is checked
    // without asserting to avoid locking tokens in case of a bug. If this situation occurs, the withdrawn
    // amount is considered to be the streamed amount, and the stream is effectively frozen.
    if streamed_amount > amounts.deposited {
        return amounts.withdrawn;
    }

    streamed_amount
}

pub fn get_refundable_amount(
    timestamps: &Timestamps,
    amounts: &Amounts,
    is_cancelable: bool,
    is_depleted: bool,
    was_canceled: bool,
) -> u64 {
    // Note that checking for `is_cancelable` also checks if the stream `was_canceled` thanks to the protocol
    // invariant that canceled streams are not cancelable anymore.
    if is_cancelable && !is_depleted {
        return amounts.deposited - get_streamed_amount(timestamps, amounts, is_depleted, was_canceled);
    }

    // Otherwise, return zero.
    0
}

pub fn get_withdrawable_amount(
    timestamps: &Timestamps,
    amounts: &Amounts,
    is_depleted: bool,
    was_canceled: bool,
) -> u64 {
    get_streamed_amount(timestamps, amounts, is_depleted, was_canceled) - amounts.withdrawn
}
