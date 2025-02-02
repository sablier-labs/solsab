use anchor_lang::prelude::*;

use crate::{state::treasury::Treasury, utils::constants};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = constants::ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury_pda: Box<Account<'info, Treasury>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    ctx.accounts.treasury_pda.bump = ctx.bumps.treasury_pda;

    Ok(())
}
