use anchor_lang::prelude::*;

use super::StreamQuery;
use crate::utils::lockup_math::get_withdrawable_amount;

pub fn handler(ctx: Context<StreamQuery>, _stream_id: u64) -> Result<u64> {
    Ok(get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts))
}
