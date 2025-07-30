use anchor_lang::prelude::*;

use crate::{
    state::Treasury,
    utils::constants::{seeds::TREASURY, ANCHOR_DISCRIMINATOR_SIZE},
};

#[derive(Accounts)]
pub struct Initialize<'info> {
    // -------------------------------------------------------------------------- //
    //                                USER ACCOUNTS                               //
    // -------------------------------------------------------------------------- //
    /// Write account: the initializer of the program.
    #[account(mut)]
    pub initializer: Signer<'info>,

    // -------------------------------------------------------------------------- //
    //                              SABLIER ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Create account: the treasury account that will hold the fees.
    #[account(
      init,
      payer = initializer,
      seeds = [TREASURY],
      space = ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
      bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    // -------------------------------------------------------------------------- //
    //                               SYSTEM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the System program.
    pub system_program: Program<'info, System>,
}

/// See the documentation for [`crate::sablier_merkle_instant::initialize`].
pub fn handler(
    ctx: Context<Initialize>,
    fee_collector: Pubkey,
    chainlink_program: Pubkey,
    chainlink_sol_usd_feed: Pubkey,
) -> Result<()> {
    ctx.accounts.treasury.initialize(ctx.bumps.treasury, fee_collector, chainlink_program, chainlink_sol_usd_feed)?;

    Ok(())
}
