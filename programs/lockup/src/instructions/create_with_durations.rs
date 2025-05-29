use anchor_lang::{prelude::*, solana_program::sysvar::clock::Clock};

use crate::instructions::create_with_timestamps;

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<create_with_timestamps::CreateWithTimestamps>,
    salt: u128,
    deposit_amount: u64,
    cliff_duration: i64,
    total_duration: i64,
    start_unlock: u64,
    cliff_unlock: u64,
    is_cancelable: bool,
) -> Result<()> {
    // Declare the start time as the current unix timestamp.
    let start_time = Clock::get()?.unix_timestamp;

    // Calculate the cliff time by adding the cliff duration to the start time using checked math.
    let cliff_time = if cliff_duration > 0 { start_time.checked_add(cliff_duration).unwrap() } else { 0 };

    // Calculate the end time by adding the total duration to the start time using checked math.
    let end_time = start_time.checked_add(total_duration).unwrap();

    // Checks, Effects, Interactions: create the stream.
    create_with_timestamps::handler(
        ctx,
        salt,
        deposit_amount,
        start_time,
        cliff_time,
        end_time,
        start_unlock,
        cliff_unlock,
        is_cancelable,
    )
}
