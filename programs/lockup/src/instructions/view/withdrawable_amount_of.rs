use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::lockup_math::get_withdrawable_amount;

pub fn handler(ctx: Context<StreamView>, _stream_id: u64) -> Result<u64> {
    Ok(get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts))
}
