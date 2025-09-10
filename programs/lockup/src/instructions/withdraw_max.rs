use anchor_lang::prelude::*;

use crate::{instructions::withdraw, utils::lockup_math::get_withdrawable_amount};

/// See the documentation for [`fn@crate::sablier_lockup::withdraw_max`].
pub fn handler(ctx: Context<withdraw::Withdraw>) -> Result<()> {
    let withdrawable_amount = get_withdrawable_amount(
        &ctx.accounts.stream_data.timestamps,
        &ctx.accounts.stream_data.amounts,
        ctx.accounts.stream_data.is_depleted,
        ctx.accounts.stream_data.was_canceled,
    );

    withdraw::handler(ctx, withdrawable_amount)
}
