use crate::{instructions::withdraw, utils::streaming_math};
use anchor_lang::prelude::*;

pub fn handler(ctx: Context<Withdraw>) -> Result<()> {
    let withdrawable_amount = streaming_math::get_withdrawable_amount(
        &ctx.accounts.stream.milestones,
        &ctx.accounts.stream.amounts.deposited,
        &ctx.accounts.stream.amounts.withdrawn,
    );

    withdraw::handler(ctx, withdrawable_amount)
}
