use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    state::campaign::Campaign,
    utils::{
        constants::CAMPAIGN_SEED, events::Clawbacked, transfer_helper::transfer_tokens, validations::check_clawback,
    },
};

#[derive(Accounts)]
pub struct Clawback<'info> {
    #[account(mut, address = campaign.creator)]
    pub campaign_creator: Signer<'info>,

    #[account()]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(address = campaign.airdrop_token_mint)]
    pub airdrop_token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      mut,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      mut,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign_creator,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_creator_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub airdrop_token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Clawback>, amount: u64) -> Result<()> {
    // Check: validate the clawback.
    check_clawback(ctx.accounts.campaign.expiration_time, ctx.accounts.campaign.first_claim_time)?;

    // Interaction: transfer tokens from the Campaign's ATA to the campaign creator's ATA.
    transfer_tokens(
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.campaign_creator_ata.to_account_info(),
        ctx.accounts.campaign.to_account_info(),
        ctx.accounts.airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        amount,
        ctx.accounts.airdrop_token_mint.decimals,
        &[&[CAMPAIGN_SEED, &[ctx.accounts.campaign.bump]]],
    )?;

    // Log the clawback.
    emit!(Clawbacked {
        amount,
        campaign: ctx.accounts.campaign.key(),
        campaign_creator: ctx.accounts.campaign_creator.key(),
    });

    Ok(())
}
