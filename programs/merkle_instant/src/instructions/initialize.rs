use anchor_lang::prelude::*;

use crate::{
    state::Treasury,
    utils::constants::{misc::ANCHOR_DISCRIMINATOR_SIZE, seeds::TREASURY_SEED},
};

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
