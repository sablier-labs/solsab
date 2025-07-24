//! Claim airdrop on behalf of eligible recipient and transfer it to the recipient ATA.
//!
//! Notes:
//! - Emits a {Claim} event.
//!
//! Accounts expected:
//! - `claimer` The transaction signer.
//! - `campaign` The account that stores the campaign details.
//! - `recipient` The address of the airdrop recipient.
//! - `airdrop_token_mint` The mint of the airdropped token.
//! - `airdrop_token_program` The Token Program of the airdropped token.
//!
//! Parameters:
//! - `index` The index of the recipient in the Merkle tree.
//! - `amount` The amount allocated to the recipient.
//! - `merkle_proof` The proof of inclusion in the Merkle tree.
//!
//! Requirements:
//! - The campaign must not have expired.
//! - The recipient's airdrop has not been claimed yet.
//! - The Merkle proof must be valid.
use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{Campaign, ClaimReceipt, Treasury},
    utils::{
        constants::{ANCHOR_DISCRIMINATOR_SIZE, CAMPAIGN_SEED, CLAIM_RECEIPT_SEED, TREASURY_SEED},
        events,
        transfer_helper::transfer_tokens,
        validations::check_claim,
    },
};

const CLAIM_FEE: u64 = 30_000_000; // The fee for claiming an airdrop, in lamports.

#[derive(Accounts)]
#[instruction(index: u32)]
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
      space = ANCHOR_DISCRIMINATOR_SIZE + ClaimReceipt::INIT_SPACE,
      seeds = [
        CLAIM_RECEIPT_SEED,
        campaign.key().as_ref(),
        index.to_le_bytes().as_ref(),
      ],
      bump
    )]
    pub claim_receipt: Box<Account<'info, ClaimReceipt>>,

    #[account(
      mut,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: This account is validated during the Merkle proof verification.
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
      bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    pub system_program: Program<'info, System>,
    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Claim>, index: u32, amount: u64, merkle_proof: Vec<[u8; 32]>) -> Result<()> {
    let campaign = ctx.accounts.campaign.clone();
    let airdrop_token_mint = ctx.accounts.airdrop_token_mint.clone();
    let claimer = ctx.accounts.claimer.clone();
    let recipient = ctx.accounts.recipient.clone();
    let treasury = ctx.accounts.treasury.clone();

    // Check: validate the claim.
    check_claim(campaign.expiration_time, campaign.merkle_root, index, recipient.key(), amount, merkle_proof)?;

    ctx.accounts.campaign.claim()?;

    // Interaction: transfer the fee from the claimer to the treasury.
    let fee_collection_ix = transfer(&claimer.key(), &treasury.key(), CLAIM_FEE);
    invoke(&fee_collection_ix, &[claimer.to_account_info(), treasury.to_account_info()])?;

    // Interaction: transfer tokens from the Campaign's ATA to the Recipient's ATA.
    transfer_tokens(
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.recipient_ata.to_account_info(),
        campaign.to_account_info(),
        airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        amount,
        airdrop_token_mint.decimals,
        &[&[
            CAMPAIGN_SEED,
            campaign.creator.key().as_ref(),
            campaign.merkle_root.as_ref(),
            campaign.expiration_time.to_le_bytes().as_ref(),
            campaign.name.as_ref(),
            airdrop_token_mint.key().as_ref(),
            &[campaign.bump],
        ]],
    )?;

    // Log the claim.
    emit!(events::Claim {
        amount,
        campaign: campaign.key(),
        claimer: claimer.key(),
        claim_receipt: ctx.accounts.claim_receipt.key(),
        index,
        recipient: recipient.key(),
    });

    Ok(())
}
