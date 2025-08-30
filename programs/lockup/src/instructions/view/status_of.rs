use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::{get_current_time, lockup_math::get_streamed_amount};

/// See the documentation for [`fn@crate::sablier_lockup::status_of`].
pub fn handler(ctx: Context<StreamView>) -> Result<StreamStatus> {
    let stream_data = &ctx.accounts.stream_data;

    if stream_data.is_depleted {
        return Ok(StreamStatus::Depleted);
    }

    if stream_data.was_canceled {
        return Ok(StreamStatus::Canceled);
    }

    // Get the current time
    let current_time = get_current_time()?;

    if current_time < stream_data.timestamps.start {
        return Ok(StreamStatus::Pending);
    }

    // Calculate the streamed amount.
    let streamed_amount = get_streamed_amount(
        &stream_data.timestamps,
        &stream_data.amounts,
        stream_data.is_depleted,
        stream_data.was_canceled,
    );

    if streamed_amount < stream_data.amounts.deposited {
        Ok(StreamStatus::Streaming)
    } else {
        Ok(StreamStatus::Settled)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum StreamStatus {
    Pending,
    Streaming,
    Settled,
    Canceled,
    Depleted,
}
