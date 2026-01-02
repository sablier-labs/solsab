use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::lockup_math::get_refundable_amount;

/// See the documentation for [`fn@crate::sablier_lockup::refundable_amount_of`].
pub fn handler(ctx: Context<StreamView>) -> Result<u64> {
    let stream_data = &ctx.accounts.stream_data;
    Ok(get_refundable_amount(
        &stream_data.model,
        &stream_data.amounts,
        stream_data.is_cancelable,
        stream_data.is_depleted,
        stream_data.was_canceled,
    ))
}
