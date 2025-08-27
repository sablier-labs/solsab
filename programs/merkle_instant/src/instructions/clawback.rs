use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::Campaign,
    utils::{constants::seeds::CAMPAIGN, events, transfer_tokens, validations::check_clawback},
};

#[derive(Accounts)]
pub struct Clawback<'info> {
    // -------------------------------------------------------------------------- //
    //                                USER ACCOUNTS                               //
    // -------------------------------------------------------------------------- //
    /// Write account: the campaign creator who will claw back the tokens.
    #[account(
      mut,
      address = campaign.creator,
    )]
    pub campaign_creator: Signer<'info>,

    /// Read account: the clawback recipient.
    /// CHECK: This can be any address.
    pub clawback_recipient: UncheckedAccount<'info>,

    /// Create if needed account: the clawback recipient's ATA for the airdrop token.
    #[account(
      init_if_needed,
      payer = campaign_creator,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = clawback_recipient,
      associated_token::token_program = airdrop_token_program
    )]
    pub clawback_recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // -------------------------------------------------------------------------- //
    //                              CAMPAIGN ACCOUNTS                             //
    // -------------------------------------------------------------------------- //
    /// Read account: the mint account of the airdrop token.
    #[account(address = campaign.airdrop_token_mint)]
    pub airdrop_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Read account: the account storing the campaign data.
    pub campaign: Box<Account<'info, Campaign>>,

    /// Write account: the campaign's ATA for the airdrop token.
    #[account(
      mut,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // -------------------------------------------------------------------------- //
    //                              PROGRAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the Token program of the airdrop token.
    pub airdrop_token_program: Interface<'info, TokenInterface>,

    /// Program account: the Associated Token program.
    pub associated_token_program: Program<'info, AssociatedToken>,

    // -------------------------------------------------------------------------- //
    //                               SYSTEM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the System program.
    pub system_program: Program<'info, System>,
}

/// See the documentation for [`fn@crate::sablier_merkle_instant::clawback`].
pub fn handler(ctx: Context<Clawback>, amount: u64) -> Result<()> {
    let campaign = ctx.accounts.campaign.clone();
    let airdrop_token_mint = ctx.accounts.airdrop_token_mint.clone();

    // Check: validate the clawback.
    check_clawback(campaign.expiration_time, campaign.first_claim_time)?;

    // Interaction: transfer tokens from the Campaign's ATA to the clawback recipient's ATA.
    transfer_tokens(
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.clawback_recipient_ata.to_account_info(),
        campaign.to_account_info(),
        airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        amount,
        airdrop_token_mint.decimals,
        &[&[
            CAMPAIGN,
            campaign.creator.key().as_ref(),
            campaign.merkle_root.as_ref(),
            campaign.campaign_start_time.to_le_bytes().as_ref(),
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
