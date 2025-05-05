use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;

use crate::{state::treasury::Treasury, utils::constants::*};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub deployer: Signer<'info>,

    #[account(
      init,
      payer = deployer,
      seeds = [TREASURY_SEED],
      space = ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
      bump
    )]
    pub treasury: Account<'info, Treasury>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, fee_collector: Pubkey) -> Result<()> {
    ctx.accounts.treasury.initialize(ctx.bumps.treasury, fee_collector)?;

    Ok(())
}
