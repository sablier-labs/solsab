use crate::{instructions::withdraw, utils::lockup_math::get_withdrawable_amount};
use anchor_lang::prelude::*;

/// Refer to the {lib.rs#withdraw_max} function explanatory comments.
pub fn handler(ctx: Context<withdraw::Withdraw>) -> Result<()> {
    let withdrawable_amount =
        get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts);

    withdraw::handler(ctx, withdrawable_amount)
}
