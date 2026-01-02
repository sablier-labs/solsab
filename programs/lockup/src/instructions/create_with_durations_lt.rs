//! Handler for creating tranched streams with relative durations.
//!
//! Converts durations to absolute timestamps and delegates to `create_with_timestamps_lt`.

use anchor_lang::prelude::*;

use crate::{
    instructions::{create_with_timestamps::CreateWithTimestamps, create_with_timestamps_lt},
    state::lockup::Tranche,
    utils::{errors::ErrorCode, time::get_current_time},
};

/// Handler for creating a tranched stream with relative durations.
///
/// # Parameters
/// * `salt` - Unique salt for PDA derivation
/// * `tranche_amounts` - Amount for each tranche
/// * `tranche_durations` - Duration offset from stream start for each tranche
/// * `is_cancelable` - Whether sender can cancel the stream
///
/// # Notes
/// - `tranche_amounts` and `tranche_durations` must have the same length.
/// - Durations are offsets from stream start, not from each other.
/// - The stream start time is set to the current timestamp.
/// - Each tranche timestamp = start_time + corresponding duration.
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
    // Each duration is an offset from start_time.
    let tranches: Vec<Tranche> = tranche_amounts
        .iter()
        .zip(tranche_durations.iter())
        .map(|(amount, duration)| {
            let timestamp = start_time
                .checked_add(*duration)
                .ok_or(ErrorCode::TrancheTimestampOverflow)?;
            Ok(Tranche {
                amount: *amount,
                timestamp,
            })
        })
        .collect::<Result<Vec<_>>>()?;

    // Delegate to timestamps handler.
    create_with_timestamps_lt::handler(ctx, salt, start_time, tranches, is_cancelable)
}
