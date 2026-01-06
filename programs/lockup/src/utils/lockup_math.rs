//! Math functions for computing streamed, withdrawable and refundable amounts for Lockup streams.

use crate::{
    state::lockup::{Amounts, LinearTimestamps, LinearUnlocks, StreamData, StreamModel, Tranche},
    utils::time::get_current_time,
};

// -------------------------------------------------------------------------- //
//                              PUBLIC FUNCTIONS                              //
// -------------------------------------------------------------------------- //

/// Returns the stream end time.
pub fn get_end_time(model: &StreamModel) -> u64 {
    match model {
        StreamModel::Linear {
            timestamps, ..
        } => timestamps.end,
        StreamModel::Tranched {
            timestamps, ..
        } => timestamps.end,
    }
}

/// Calculates the amount the sender would receive if they were to cancel the stream.
pub fn get_refundable_amount(stream_data: &StreamData) -> u64 {
    // Note: checking `is_cancelable` also implicitly checks `was_canceled`
    // thanks to the protocol invariant that canceled streams are non-cancelable.
    if stream_data.is_cancelable && !stream_data.is_depleted {
        return stream_data.amounts.deposited.saturating_sub(get_streamed_amount(stream_data));
    }

    // Otherwise, return zero.
    0
}

/// Returns the stream start time.
pub fn get_start_time(model: &StreamModel) -> u64 {
    match model {
        StreamModel::Linear {
            timestamps, ..
        } => timestamps.start,
        StreamModel::Tranched {
            timestamps, ..
        } => timestamps.start,
    }
}

/// Calculates the total amount streamed to the recipient at the current time.
///
/// Dispatches to model-specific calculation based on the model of the stream.
pub fn get_streamed_amount(stream_data: &StreamData) -> u64 {
    // Handle the terminal states first
    if stream_data.is_depleted {
        return stream_data.amounts.withdrawn;
    }
    if stream_data.was_canceled {
        return stream_data.amounts.deposited - stream_data.amounts.refunded;
    }

    // Dispatch to model-specific calculation
    match &stream_data.model {
        StreamModel::Linear {
            timestamps,
            unlocks,
        } => get_streamed_amount_linear(timestamps, unlocks, &stream_data.amounts),
        StreamModel::Tranched {
            tranches, ..
        } => get_streamed_amount_tranched(tranches),
    }
}

/// Calculates the amount the recipient can withdraw at the current time.
pub fn get_withdrawable_amount(stream_data: &StreamData) -> u64 {
    get_streamed_amount(stream_data).saturating_sub(stream_data.amounts.withdrawn)
}

// -------------------------------------------------------------------------- //
//                          PRIVATE HELPER FUNCTIONS                          //
// -------------------------------------------------------------------------- //

/// Calculates the streamed amount for a linear stream.
fn get_streamed_amount_linear(timestamps: &LinearTimestamps, unlocks: &LinearUnlocks, amounts: &Amounts) -> u64 {
    // Get the current time, defaulting to 0 on failure.
    let now = get_current_time().unwrap_or(0);

    // Before start: nothing unlocked
    if timestamps.start > now {
        return 0;
    }

    // Before cliff (if there is one): only start unlock available
    if timestamps.cliff > now {
        return unlocks.start;
    }

    // After end: everything unlocked
    if now > timestamps.end {
        return amounts.deposited;
    }

    // Calculate the sum of instant unlock amounts
    let unlock_amounts_sum = unlocks.start + unlocks.cliff;

    // Safety check: if the unlock amounts exceed the deposit amount (which should never happen) or are equal to it, return the deposit amount.
    if unlock_amounts_sum >= amounts.deposited {
        return amounts.deposited;
    }

    // Determine when linear streaming begins
    let streaming_start_time = if timestamps.cliff > 0 {
        timestamps.cliff
    } else {
        timestamps.start
    };

    // Use u128 scaling for precision in percentage calculation
    const SCALING_FACTOR: u128 = 1e18 as u128;

    // Calculate time variables. Scale to 18 decimals for increased precision and cast to u128 to prevent overflow.
    let elapsed_time = (now - streaming_start_time) as u128 * SCALING_FACTOR;
    let streamable_time_range = (timestamps.end - streaming_start_time) as u128;
    let elapsed_time_pct = elapsed_time / streamable_time_range;

    let streamable_amount = (amounts.deposited - unlock_amounts_sum) as u128;
    let streamed_amount = unlock_amounts_sum + ((elapsed_time_pct * streamable_amount) / SCALING_FACTOR) as u64;

    // Although the streamed amount should never exceed the deposited amount, this condition is checked
    // without asserting to avoid locking tokens in case of a bug. If this situation occurs, the withdrawn
    // amount is considered to be the streamed amount, and the stream is effectively frozen.
    if streamed_amount > amounts.deposited {
        return amounts.withdrawn;
    }

    streamed_amount
}

/// Calculates the streamed amount for a tranched stream by summing the amounts of all the past tranches.
fn get_streamed_amount_tranched(tranches: &[Tranche]) -> u64 {
    // Get the current time, defaulting to 0 on failure.
    let now = get_current_time().unwrap_or(0);

    tranches.iter().take_while(|t| t.timestamp <= now).map(|t| t.amount).sum()
}
