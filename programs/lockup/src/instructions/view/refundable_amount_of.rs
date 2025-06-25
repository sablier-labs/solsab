use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::lockup_math::get_refundable_amount;

/// Refer to the {lib.rs#refundable_amount_of} function explanatory comments.
pub fn handler(ctx: Context<StreamView>) -> Result<u64> {
    Ok(get_refundable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts))
}
