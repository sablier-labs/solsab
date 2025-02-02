use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::treasury::Treasury;

// TODO: reconsider the name of this struct

#[derive(Accounts)]
pub struct InitTreasuryAndRecipientATAsIfNeeded<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: The recipient may be any account, as long as it is the authority of recipient_ata
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = asset_mint,
        associated_token::authority = recipient,
        // associated_token::token_program = token_program,
    )]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [b"treasury"],
        bump = treasury_pda.bump
    )]
    pub treasury_pda: Box<Account<'info, Treasury>>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = asset_mint,
        associated_token::authority = treasury_pda,
        // associated_token::token_program = token_program
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>, // TODO: do we really need to pass this account?
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(_ctx: Context<InitTreasuryAndRecipientATAsIfNeeded>) -> Result<()> {
    Ok(())
}
