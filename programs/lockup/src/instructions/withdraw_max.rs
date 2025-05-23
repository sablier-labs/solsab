use crate::{instructions::withdraw, utils::lockup_math::get_withdrawable_amount};
use anchor_lang::prelude::*;

pub fn handler(ctx: Context<withdraw::Withdraw>, salt: u64) -> Result<()> {
    let withdrawable_amount =
        get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts);

    withdraw::handler(ctx, salt, withdrawable_amount)
}
