use anchor_lang::prelude::*;

use crate::{state::Treasury, utils::constants::*};

#[derive(Accounts)]
pub struct Initialize<'info> {
    // -------------------------------------------------------------------------- //
    //                                USER ACCOUNTS                               //
    // -------------------------------------------------------------------------- //
    #[account(mut)]
    pub initializer: Signer<'info>,

    // -------------------------------------------------------------------------- //
    //                              SABLIER ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    #[account(
      init,
      payer = initializer,
      seeds = [TREASURY_SEED],
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

pub fn handler(ctx: Context<Initialize>, fee_collector: Pubkey) -> Result<()> {
    ctx.accounts.treasury.initialize(ctx.bumps.treasury, fee_collector)?;

    Ok(())
}
