use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::campaign::Campaign,
    utils::{
        constants::CAMPAIGN_SEED, events::AirdropClaimed, transfer_helper::transfer_tokens, validations::check_claim,
    },
};

#[derive(Accounts)]
#[instruction(amount: u64, merkle_root: [u8; 32])]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(
      mut,
      seeds = [CAMPAIGN_SEED, &merkle_root],
      bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
      mint::token_program = airdrop_token_program,
      constraint = airdrop_token_mint.key() == campaign.airdrop_token_mint
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
      associated_token::authority = claimer,
      associated_token::token_program = airdrop_token_program
    )]
    pub claimer_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<Claim>,
    merkle_root: [u8; 32],
    leaf_id: u32,
    amount: u64,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    // Check: validate the claim.
    check_claim(merkle_root, ctx.accounts.claimer.key(), leaf_id, amount, &proof)?;

    // Interaction: transfer tokens from the Campaign's ATA to the Claimer's ATA.
    transfer_tokens(
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.claimer_ata.to_account_info(),
        ctx.accounts.campaign.to_account_info(),
        ctx.accounts.airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        amount,
        ctx.accounts.airdrop_token_mint.decimals,
        &[&[CAMPAIGN_SEED, &[ctx.accounts.campaign.bump]]],
    )?;

    // Log the clawback.
    emit!(AirdropClaimed {
        campaign: ctx.accounts.campaign.key(),
        claimer: ctx.accounts.claimer.key(),
        leaf_id,
        amount,
        proof,
    });
    Ok(())
}
