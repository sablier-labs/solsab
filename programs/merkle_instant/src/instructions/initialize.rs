//! Initializes the program with the provided fee collector address.
//!
//! Accounts expected:
//! - `initializer` The transaction signer.
//!
//! Parameters:
//! - `fee_collector` The address that will have the authority to collect fees.

use anchor_lang::prelude::*;

use crate::{state::Treasury, utils::constants::*};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(
      init,
      payer = initializer,
      seeds = [TREASURY_SEED],
      space = ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
      bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, fee_collector: Pubkey) -> Result<()> {
    ctx.accounts.treasury.initialize(ctx.bumps.treasury, fee_collector)?;

    Ok(())
}
