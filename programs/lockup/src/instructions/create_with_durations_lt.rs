//! Handler for creating tranched streams with relative durations.
//!
//! Converts durations to absolute timestamps and delegates to `create_with_timestamps_lt`.

use anchor_lang::prelude::*;

use crate::{
    instructions::{create_with_timestamps_ll::CreateWithTimestamps, create_with_timestamps_lt},
    state::lockup::Tranche,
    utils::{errors::ErrorCode, time::get_current_time},
};

/// Handler for creating a tranched stream with relative durations.
///
/// # Parameters
/// * `salt` - Unique salt for PDA derivation
/// * `tranche_amounts` - Amount for each tranche
/// * `tranche_durations` - Duration offset from the previous tranche (first is offset from start)
/// * `is_cancelable` - Whether sender can cancel the stream
///
/// # Notes
/// - `tranche_amounts` and `tranche_durations` must have the same length.
/// - The stream start time is set to the current timestamp.
pub fn handler(
    ctx: Context<CreateWithTimestamps>,
    salt: u128,
    tranche_amounts: Vec<u64>,
    tranche_durations: Vec<u64>,
    is_cancelable: bool,
) -> Result<()> {
    // Validate: amounts and durations must have same length.
    if tranche_amounts.len() != tranche_durations.len() {
        return Err(ErrorCode::TrancheAmountsDurationsMismatch.into());
    }

    // Get current time as stream start.
    let start_time = get_current_time()?;

    // Convert durations to absolute timestamps.
    // First duration is the offset from the start time, subsequent durations are offsets from the duration of the previous tranche.
    let mut tranches = Vec::with_capacity(tranche_amounts.len());
    let mut prev_timestamp = start_time;

    for (amount, duration) in tranche_amounts.iter().zip(tranche_durations.iter()) {
        let timestamp = prev_timestamp.checked_add(*duration).ok_or(ErrorCode::TrancheTimestampOverflow)?;
        tranches.push(Tranche {
            amount: *amount,
            timestamp,
        });
        prev_timestamp = timestamp;
    }

    // Delegate to timestamps handler.
    create_with_timestamps_lt::handler(ctx, salt, start_time, tranches, is_cancelable)
}
