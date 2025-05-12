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

    #[account()]
    /// CHECK: The recipient may be any Merkle Tree leaf (verified by check_claim())
    pub recipient: UncheckedAccount<'info>,

    #[account(
      init_if_needed,
      payer = claimer,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = recipient,
      associated_token::token_program = airdrop_token_program
    )]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
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
    check_claim(merkle_root, ctx.accounts.recipient.key(), leaf_id, amount, &proof)?;

    // Interaction: transfer tokens from the Campaign's ATA to the Recipient's ATA.
    transfer_tokens(
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.recipient_ata.to_account_info(),
        ctx.accounts.campaign.to_account_info(),
        ctx.accounts.airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        amount,
        ctx.accounts.airdrop_token_mint.decimals,
        &[&[CAMPAIGN_SEED, &[ctx.accounts.campaign.bump]]],
    )?;

    // Effect: Update the campaign's claim status.
    ctx.accounts.campaign.claim_status[leaf_id as usize] = true;

    // Log the clawback.
    emit!(AirdropClaimed {
        campaign: ctx.accounts.campaign.key(),
        claimer: ctx.accounts.claimer.key(),
        recipient: ctx.accounts.recipient.key(),
        leaf_id,
        amount,
        proof,
    });
    Ok(())
}
