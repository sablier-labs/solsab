use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{Campaign, ClaimStatus, Treasury},
    utils::{
        constants::{ANCHOR_DISCRIMINATOR_SIZE, CAMPAIGN_SEED, CLAIM_STATUS_SEED, TREASURY_SEED},
        events::Claimed,
        transfer_helper::transfer_tokens,
        validations::check_claim,
    },
};

const CLAIM_FEE: u64 = 30_000_000; // The fee for claiming an airdrop, in lamports.

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(address = campaign.airdrop_token_mint)]
    pub airdrop_token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      init,
      payer = claimer,
      space = ANCHOR_DISCRIMINATOR_SIZE + ClaimStatus::INIT_SPACE,
      seeds = [
        CLAIM_STATUS_SEED,
        campaign.key().as_ref(),
        index.to_le_bytes().as_ref(),
      ],
      bump
    )]
    pub claim_status: Box<Account<'info, ClaimStatus>>,

    #[account(
      mut,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account()]
    /// CHECK: Anyone can claim in behalf of the recipient. This is validated in the merkle proof verifcaition.
    pub recipient: UncheckedAccount<'info>,

    #[account(
      init_if_needed,
      payer = claimer,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = recipient,
      associated_token::token_program = airdrop_token_program
    )]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      mut,
      seeds = [TREASURY_SEED],
      bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    pub system_program: Program<'info, System>,
    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Claim>, index: u32, amount: u64, merkle_proof: Vec<[u8; 32]>) -> Result<()> {
    // Check: validate the claim.
    check_claim(
        ctx.accounts.campaign.expiration_time,
        ctx.accounts.campaign.merkle_root,
        index,
        ctx.accounts.recipient.key(),
        amount,
        &merkle_proof,
    )?;

    ctx.accounts.campaign.claim()?;
    ctx.accounts.claim_status.bump = ctx.bumps.claim_status;

    // Interaction: transfer the fee from the claimer to the treasury.
    let fee_collection_ix = transfer(&ctx.accounts.claimer.key(), &ctx.accounts.treasury.key(), CLAIM_FEE);
    invoke(&fee_collection_ix, &[ctx.accounts.claimer.to_account_info(), ctx.accounts.treasury.to_account_info()])?;

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

    // Log the claim.
    emit!(Claimed {
        amount,
        campaign: ctx.accounts.campaign.key(),
        claimer: ctx.accounts.claimer.key(),
        claim_status: ctx.accounts.claim_status.key(),
        index,
        recipient: ctx.accounts.recipient.key(),
    });

    Ok(())
}
