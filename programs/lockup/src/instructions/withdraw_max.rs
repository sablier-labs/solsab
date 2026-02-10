use anchor_lang::prelude::*;

use crate::{instructions::withdraw, utils::lockup_math::get_withdrawable_amount};

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_lockup::withdraw_max`].
pub fn handler(ctx: Context<withdraw::Withdraw>) -> Result<()> {
    let withdrawable_amount = get_withdrawable_amount(&ctx.accounts.stream_data);
    withdraw::handler(ctx, withdrawable_amount)
}
