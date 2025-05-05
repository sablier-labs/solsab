use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::campaign::Campaign,
    utils::{constants::CAMPAIGN_SEED, events::CampaignFunded, transfer_helper::transfer_tokens},
};

#[derive(Accounts)]
#[instruction(amount: u64, merkle_root: [u8; 32])]
pub struct FundCampaign<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
      mut,
      seeds = [CAMPAIGN_SEED, &merkle_root],
      bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
      mut,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      mint::token_program = airdrop_token_program,
      constraint = airdrop_token_mint.key() == campaign.airdrop_token_mint
    )]
    pub airdrop_token_mint: Box<InterfaceAccount<'info, Mint>>,

    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<FundCampaign>, _merkle_root: [u8; 32], amount: u64) -> Result<()> {
    // Interaction: transfer tokens from the sender's ATA to the Treasury ATA.
    transfer_tokens(
        ctx.accounts.signer.to_account_info(),
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.signer.to_account_info(),
        ctx.accounts.airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        amount,
        ctx.accounts.airdrop_token_mint.decimals,
        &[],
    )?;

    // Log the campaign funding.
    emit!(CampaignFunded { campaign: ctx.accounts.campaign.key(), funder: ctx.accounts.signer.key(), amount });
    Ok(())
}
