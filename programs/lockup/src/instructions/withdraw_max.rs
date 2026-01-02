use anchor_lang::prelude::*;

use crate::{instructions::withdraw, utils::lockup_math::get_withdrawable_amount};

/// See the documentation for [`fn@crate::sablier_lockup::withdraw_max`].
pub fn handler(ctx: Context<withdraw::Withdraw>) -> Result<()> {
    let stream_data = &ctx.accounts.stream_data;
    let withdrawable_amount = get_withdrawable_amount(
        &stream_data.model,
        &stream_data.amounts,
        stream_data.is_depleted,
        stream_data.was_canceled,
    );

    withdraw::handler(ctx, withdrawable_amount)
}
