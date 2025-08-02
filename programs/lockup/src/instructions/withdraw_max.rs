use crate::{instructions::withdraw, utils::lockup_math::get_withdrawable_amount};
use anchor_lang::prelude::*;

/// See the documentation for [`crate::sablier_lockup::withdraw_max`].
pub fn handler(ctx: Context<withdraw::Withdraw>) -> Result<()> {
    let withdrawable_amount =
        get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts);

    withdraw::handler(ctx, withdrawable_amount)
}
