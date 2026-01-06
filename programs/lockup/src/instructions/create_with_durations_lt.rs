use anchor_lang::prelude::*;

use crate::{
    instructions::{create_with_timestamps_ll::CreateWithTimestamps, create_with_timestamps_lt},
    state::lockup::Tranche,
    utils::{errors::ErrorCode, time::get_current_time},
};

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_lockup::create_with_durations_lt`].
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
