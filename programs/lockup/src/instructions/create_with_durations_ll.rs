use anchor_lang::prelude::*;

use crate::{instructions::create_with_timestamps_ll, utils::time::get_current_time};

/// See the documentation for [`fn@crate::sablier_lockup::create_with_durations_ll`].
#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<create_with_timestamps_ll::CreateWithTimestamps>,
    salt: u128,
    deposit_amount: u64,
    cliff_duration: u64,
    total_duration: u64,
    start_unlock_amount: u64,
    cliff_unlock_amount: u64,
    is_cancelable: bool,
) -> Result<()> {
    // Declare the start time as the current unix timestamp.
    let start_time = get_current_time()?;

    // Calculate the cliff time by adding the cliff duration to the start time using checked math.
    let cliff_time = if cliff_duration > 0 {
        start_time.checked_add(cliff_duration).unwrap()
    } else {
        0
    };

    // Calculate the end time by adding the total duration to the start time using checked math.
    let end_time = start_time.checked_add(total_duration).unwrap();

    // Checks, Effects, Interactions: create the stream.
    create_with_timestamps_ll::handler(
        ctx,
        salt,
        deposit_amount,
        start_time,
        cliff_time,
        end_time,
        start_unlock_amount,
        cliff_unlock_amount,
        is_cancelable,
    )
}
