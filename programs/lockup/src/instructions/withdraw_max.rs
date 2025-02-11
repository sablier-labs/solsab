use crate::{instructions::withdraw, utils::streaming_math::get_withdrawable_amount};
use anchor_lang::prelude::*;

pub fn handler(ctx: Context<withdraw::Withdraw>, stream_id: u64) -> Result<()> {
    let withdrawable_amount = get_withdrawable_amount(
        &ctx.accounts.stream_data.milestones,
        ctx.accounts.stream_data.amounts.deposited,
        ctx.accounts.stream_data.amounts.withdrawn,
    );

    withdraw::handler(ctx, stream_id, withdrawable_amount)
}
