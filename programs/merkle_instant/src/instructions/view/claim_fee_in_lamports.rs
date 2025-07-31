use anchor_lang::prelude::*;

use crate::{
    state::treasury::Treasury,
    utils::{
        constants::{seeds::TREASURY, CLAIM_FEE_USD},
        fee_calculation::convert_usd_fee_to_lamports,
    },
};

#[derive(Accounts)]
pub struct ClaimFeeInLamports<'info> {
    /// Read account: the treasury account that receives the claim fee.
    #[account(
      mut,
      seeds = [TREASURY],
      bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    /// Read account: The Chainlink program used to retrieve on-chain price feeds.
    /// CHECK: This is the Chainlink program.
    #[account(address = treasury.chainlink_program)]
    pub chainlink_program: AccountInfo<'info>,

    /// Read account: The account providing the SOL/USD price feed data.
    /// CHECK: We're reading data from this Chainlink feed.
    #[account(address = treasury.chainlink_sol_usd_feed)]
    pub chainlink_sol_usd_feed: AccountInfo<'info>,
}

pub fn handler(ctx: Context<ClaimFeeInLamports>) -> Result<u64> {
    let fee_in_lamports = convert_usd_fee_to_lamports(
        CLAIM_FEE_USD,
        ctx.accounts.chainlink_program.to_account_info(),
        ctx.accounts.chainlink_sol_usd_feed.to_account_info(),
    );

    Ok(fee_in_lamports)
}
