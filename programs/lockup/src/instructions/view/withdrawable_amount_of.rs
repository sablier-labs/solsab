use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::lockup_math::get_withdrawable_amount;

/// See the documentation for [`fn@crate::sablier_lockup::withdrawable_amount_of`].
pub fn handler(ctx: Context<StreamView>) -> Result<u64> {
    Ok(get_withdrawable_amount(
        &ctx.accounts.stream_data.timestamps,
        &ctx.accounts.stream_data.amounts,
        ctx.accounts.stream_data.is_depleted,
        ctx.accounts.stream_data.was_canceled,
    ))
}
