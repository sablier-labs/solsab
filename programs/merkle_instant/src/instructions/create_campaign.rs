use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::campaign::Campaign,
    utils::{
        constants::{ANCHOR_DISCRIMINATOR_SIZE, CAMPAIGN_SEED},
        events::CampaignCreated,
        validations::check_create_campaign,
    },
};

#[derive(Accounts)]
#[instruction(merkle_root: [u8; 32])]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub campaign_creator: Signer<'info>,

    #[account(
      init,
      payer = campaign_creator,
      seeds = [CAMPAIGN_SEED, &merkle_root], // TODO: use the IPFS id as the seed, instead?
      space = ANCHOR_DISCRIMINATOR_SIZE + Campaign::INIT_SPACE,
      bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(
      init,
      payer = campaign_creator,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mint::token_program = airdrop_token_program)]
    pub airdrop_token_mint: Box<InterfaceAccount<'info, Mint>>,

    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateCampaign>,
    name: String,
    // TODO: if the passed recipient_count is smaller than the actual number of Merkle Tree leaves, a double-spend
    // attack is possible? (claiming the allocation multiple times by the same recipient with an id >
    // recipient_count) How do we prevent this?
    // Update: this attack shouldn't be possible, as the claim Ix execution should fail when trying to update the Claim
    // Status of the respective airdrop recipient. Write a test confirming this.
    recipient_count: u32,
    ipfs_id: String,
    merkle_root: [u8; 32],
    expiration_time: i64,
) -> Result<()> {
    // Check: validate the campaign creation.
    check_create_campaign(expiration_time)?;

    // Effect: Initialize the campaign account.
    ctx.accounts.campaign.create(
        ctx.bumps.campaign,
        name.clone(),
        ctx.accounts.airdrop_token_mint.key(),
        ipfs_id.clone(),
        merkle_root,
        expiration_time,
        ctx.accounts.campaign_creator.key(),
        recipient_count,
    )?;

    // Log the campaign creation.
    emit!(CampaignCreated {
        campaign: ctx.accounts.campaign.key(),
        creator: ctx.accounts.campaign_creator.key(),
        campaign_name: name,
        recipient_count,
        ipfs_id,
        merkle_root,
        expiration_time,
    });

    Ok(())
}
