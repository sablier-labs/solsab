use anchor_lang::prelude::*;

use super::StreamView;
use crate::utils::lockup_math::get_streamed_amount;

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_lockup::streamed_amount_of`].
pub fn handler(ctx: Context<StreamView>) -> Result<u64> {
    Ok(get_streamed_amount(&ctx.accounts.stream_data))
}
