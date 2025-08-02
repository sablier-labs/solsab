use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::lockup_math::get_refundable_amount;

/// See the documentation for [`crate::sablier_lockup::refundable_amount_of`].
pub fn handler(ctx: Context<StreamView>) -> Result<u64> {
    Ok(get_refundable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts))
}
