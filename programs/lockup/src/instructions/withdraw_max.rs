use crate::{instructions::withdraw, utils::streaming_math::get_withdrawable_amount};
use anchor_lang::prelude::*;

pub fn handler(ctx: Context<withdraw::Withdraw>) -> Result<()> {
    let withdrawable_amount = get_withdrawable_amount(
        &ctx.accounts.stream.milestones,
        ctx.accounts.stream.amounts.deposited,
        ctx.accounts.stream.amounts.withdrawn,
    );

    withdraw::handler(ctx, withdrawable_amount)
}
