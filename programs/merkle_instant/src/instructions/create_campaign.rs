use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::Campaign,
    utils::{
        constants::{ANCHOR_DISCRIMINATOR_SIZE, CAMPAIGN_SEED},
        events,
    },
};

#[derive(Accounts)]
#[instruction(
    merkle_root: [u8; 32],
    campaign_start_time: i64,
    expiration_time: i64,
    name: String,
)]
pub struct CreateCampaign<'info> {
    // -------------------------------------------------------------------------- //
    //                                USER ACCOUNTS                               //
    // -------------------------------------------------------------------------- //
    #[account(mut)]
    pub creator: Signer<'info>,

    // -------------------------------------------------------------------------- //
    //                              CAMPAIGN ACCOUNTS                             //
    // -------------------------------------------------------------------------- //
    #[account(mint::token_program = airdrop_token_program)]
    pub airdrop_token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      init,
      payer = creator,
      space = ANCHOR_DISCRIMINATOR_SIZE + Campaign::INIT_SPACE,
      seeds = [
        CAMPAIGN_SEED,
        creator.key().as_ref(),
        merkle_root.as_ref(),
        campaign_start_time.to_le_bytes().as_ref(),
        expiration_time.to_le_bytes().as_ref(),
        name.as_ref(),
        airdrop_token_mint.key().as_ref(),
     ],
     bump,
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(
      init,
      payer = creator,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // -------------------------------------------------------------------------- //
    //                              PROGRAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    // -------------------------------------------------------------------------- //
    //                               SYSTEM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the System program.
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<CreateCampaign>,
    merkle_root: [u8; 32],
    campaign_start_time: i64,
    expiration_time: i64,
    ipfs_cid: String,
    name: String,
    aggregate_amount: u64,
    recipient_count: u32,
) -> Result<()> {
    // Effect: Initialize the campaign account.
    ctx.accounts.campaign.create(
        ctx.accounts.airdrop_token_mint.key(),
        ctx.bumps.campaign,
        campaign_start_time,
        ctx.accounts.creator.key(),
        expiration_time,
        ipfs_cid.clone(),
        merkle_root,
        name.clone(),
    )?;

    // Log the campaign creation.
    emit!(events::CreateCampaign {
        aggregate_amount,
        campaign: ctx.accounts.campaign.key(),
        campaign_name: name,
        campaign_start_time,
        creator: ctx.accounts.creator.key(),
        expiration_time,
        ipfs_cid,
        merkle_root,
        recipient_count,
        token_decimals: ctx.accounts.airdrop_token_mint.decimals,
        token_mint: ctx.accounts.airdrop_token_mint.key(),
    });

    Ok(())
}
