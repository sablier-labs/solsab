use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::lockup_math::get_refundable_amount;

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_lockup::refundable_amount_of`].
pub fn handler(ctx: Context<StreamView>) -> Result<u64> {
    Ok(get_refundable_amount(&ctx.accounts.stream_data))
}
