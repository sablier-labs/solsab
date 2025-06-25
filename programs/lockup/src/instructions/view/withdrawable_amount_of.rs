use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::lockup_math::get_withdrawable_amount;

/// Refer to the {lib.rs#withdrawable_amount_of} function explanatory comments.
pub fn handler(ctx: Context<StreamView>) -> Result<u64> {
    Ok(get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts))
}
