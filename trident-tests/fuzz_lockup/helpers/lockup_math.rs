use crate::types::{Amounts, Timestamps};

/// This file matches the logic from programs/lockup/src/utils/lockup_math.rs
/// It's reimplemented here because Trident depends on an older version of Solana compared to sablier_lockup

/// Calculate the streamed amount
pub fn get_streamed_amount(
    timestamps: &Timestamps,
    amounts: &Amounts,
    is_depleted: bool,
    was_canceled: bool,
    now: u64,
) -> u64 {
    if is_depleted {
        return amounts.withdrawn;
    } else if was_canceled {
        return amounts.deposited - amounts.refunded;
    }

    if timestamps.start > now {
        return 0;
    }

    if timestamps.cliff > now {
        return amounts.start_unlock;
    }

    if timestamps.end <= now {
        return amounts.deposited;
    }

    let unlock_amounts_sum: u64 = amounts.start_unlock + amounts.cliff_unlock;

    if unlock_amounts_sum >= amounts.deposited {
        return amounts.deposited;
    }

    let streaming_start_time = if timestamps.cliff == 0 {
        timestamps.start
    } else {
        timestamps.cliff
    };

    const SCALING_FACTOR: u128 = 1_000_000_000_000_000_000; // 1e18

    let elapsed_time = (now - streaming_start_time) as u128 * SCALING_FACTOR;
    let streamable_range = (timestamps.end - streaming_start_time) as u128;
    let elapsed_time_percentage = elapsed_time / streamable_range;

    let streamable_amount = (amounts.deposited - unlock_amounts_sum) as u128;
    let streamed_amount = unlock_amounts_sum + ((elapsed_time_percentage * streamable_amount) / SCALING_FACTOR) as u64;

    if streamed_amount > amounts.deposited {
        return amounts.withdrawn;
    }

    streamed_amount
}

/// Calculate the refundable amount
/// This matches the logic in programs/lockup/src/utils/lockup_math.rs
pub fn get_refundable_amount(
    timestamps: &Timestamps,
    amounts: &Amounts,
    is_cancelable: bool,
    is_depleted: bool,
    was_canceled: bool,
    now: u64,
) -> u64 {
    // Note that checking for `is_cancelable` also checks if the stream `was_canceled` thanks to the protocol
    // invariant that canceled streams are not cancelable anymore.
    if is_cancelable && !is_depleted {
        return amounts.deposited - get_streamed_amount(timestamps, amounts, is_depleted, was_canceled, now);
    }

    // Otherwise, return zero.
    0
}

/// Calculate the withdrawable amount
/// This matches the logic in programs/lockup/src/utils/lockup_math.rs
pub fn get_withdrawable_amount(
    timestamps: &Timestamps,
    amounts: &Amounts,
    is_depleted: bool,
    was_canceled: bool,
    now: u64,
) -> u64 {
    get_streamed_amount(timestamps, amounts, is_depleted, was_canceled, now) - amounts.withdrawn
}

/// Return whether the stream is depleted
pub fn is_stream_depleted(amounts: &Amounts) -> bool {
    amounts.withdrawn == amounts.deposited
}
