use anchor_lang::prelude::*;

use crate::{state::treasury::Treasury, utils::constants::*};

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

    #[account()]
    /// CHECK: This account is used to collect fees from the treasury. May be any account.
    pub fee_collector: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    ctx.accounts.treasury.initialize(ctx.bumps.treasury, ctx.accounts.fee_collector.key())?;

    Ok(())
}
