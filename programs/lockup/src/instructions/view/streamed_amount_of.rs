use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::lockup_math::get_streamed_amount;

pub fn handler(ctx: Context<StreamView>) -> Result<u64> {
    Ok(get_streamed_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts))
}
