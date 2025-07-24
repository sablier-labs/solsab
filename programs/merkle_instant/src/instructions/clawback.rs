use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::Campaign,
    utils::{constants::CAMPAIGN_SEED, events, transfer_helper::transfer_tokens, validations::check_clawback},
};

#[derive(Accounts)]
pub struct Clawback<'info> {
    #[account(
      mut,
      address = campaign.creator,
    )]
    pub campaign_creator: Signer<'info>,

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

    /// CHECK: This can be any address.
    pub clawback_recipient: UncheckedAccount<'info>,

    #[account(
      init_if_needed,
      payer = campaign_creator,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = clawback_recipient,
      associated_token::token_program = airdrop_token_program
    )]
    pub clawback_recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Clawback>, amount: u64) -> Result<()> {
    let campaign = ctx.accounts.campaign.clone();
    let airdrop_token_mint = ctx.accounts.airdrop_token_mint.clone();

    // Check: validate the clawback.
    check_clawback(campaign.expiration_time, campaign.first_claim_time)?;

    // Interaction: transfer tokens from the Campaign's ATA to the campaign creator's ATA.
    transfer_tokens(
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.clawback_recipient_ata.to_account_info(),
        campaign.to_account_info(),
        airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        amount,
        airdrop_token_mint.decimals,
        &[&[
            CAMPAIGN_SEED,
            campaign.creator.key().as_ref(),
            campaign.merkle_root.as_ref(),
            campaign.start_time.to_le_bytes().as_ref(),
            campaign.expiration_time.to_le_bytes().as_ref(),
            campaign.name.as_ref(),
            airdrop_token_mint.key().as_ref(),
            &[campaign.bump],
        ]],
    )?;

    // Log the clawback.
    emit!(events::Clawback {
        amount,
        campaign: campaign.key(),
        campaign_creator: ctx.accounts.campaign_creator.key(),
        clawback_recipient: ctx.accounts.clawback_recipient.key()
    });

    Ok(())
}
