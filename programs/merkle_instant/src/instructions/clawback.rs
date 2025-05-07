use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::campaign::Campaign,
    utils::{
        constants::CAMPAIGN_SEED, events::FundsClawedBack, transfer_helper::transfer_tokens,
        validations::check_clawback,
    },
};

#[derive(Accounts)]
#[instruction(amount: u64, merkle_root: [u8; 32])]
pub struct Clawback<'info> {
    #[account(
      mut,
      address = campaign.creator)]
    pub campaign_creator: Signer<'info>,

    #[account(
      mut,
      seeds = [CAMPAIGN_SEED, &merkle_root],
      bump = campaign.bump,
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(
      address = campaign.airdrop_token_mint,
      mint::token_program = airdrop_token_program,
    )]
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
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Clawback>, _merkle_root: [u8; 32], requested_amount: u64) -> Result<()> {
    // Check: validate the clawback.
    check_clawback(requested_amount, ctx.accounts.campaign_ata.amount, ctx.accounts.campaign.expiration_time)?;

    // Interaction: transfer tokens from the Campaign's ATA to the campaign creator's ATA.
    transfer_tokens(
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.campaign_creator_ata.to_account_info(),
        ctx.accounts.campaign.to_account_info(),
        ctx.accounts.airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        requested_amount,
        ctx.accounts.airdrop_token_mint.decimals,
        &[&[CAMPAIGN_SEED, &[ctx.accounts.campaign.bump]]],
    )?;

    // Log the clawback.
    emit!(FundsClawedBack {
        campaign: ctx.accounts.campaign.key(),
        clawback_amount: requested_amount,
        tx_signer: ctx.accounts.campaign_creator.key(),
    });
    Ok(())
}
