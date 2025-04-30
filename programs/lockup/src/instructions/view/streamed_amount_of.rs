use anchor_lang::prelude::*;

use super::StreamViewContext;
use crate::utils::lockup_math::get_streamed_amount;

pub fn handler(ctx: Context<StreamViewContext>, _stream_id: u64) -> Result<u64> {
    Ok(get_streamed_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts))
}
