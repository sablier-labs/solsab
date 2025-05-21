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
    },
};

#[derive(Accounts)]
#[instruction(merkle_root: [u8; 32])]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
      init,
      payer = creator,
      space = ANCHOR_DISCRIMINATOR_SIZE + Campaign::INIT_SPACE,
      seeds = [
        CAMPAIGN_SEED,
        creator.key().as_ref(),
        merkle_root.as_ref()
     ],
     bump
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

    #[account(mint::token_program = airdrop_token_program)]
    pub airdrop_token_mint: Box<InterfaceAccount<'info, Mint>>,

    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateCampaign>,
    // TODO: if the passed recipient_count is smaller than the actual number of Merkle Tree leaves, a double-spend
    // attack is possible? (claiming the allocation multiple times by the same recipient with an id >
    // recipient_count) How do we prevent this?
    // Update: this attack shouldn't be possible, as the claim Ix execution should fail when trying to update the Claim
    // Status of the respective airdrop recipient. Write a test confirming this.
    merkle_root: [u8; 32],
    expiration_time: i64,
    name: String,
    ipfs_id: String,
    aggregate_amount: u64,
    recipient_count: u32,
) -> Result<()> {
    // Effect: Initialize the campaign account.
    ctx.accounts.campaign.create(
        ctx.accounts.airdrop_token_mint.key(),
        ctx.bumps.campaign,
        ctx.accounts.creator.key(),
        expiration_time,
        ipfs_id.clone(),
        merkle_root,
        name.clone(),
    )?;

    // Log the campaign creation.
    emit!(CampaignCreated {
        merkle_root,
        campaign: ctx.accounts.campaign.key(),
        creator: ctx.accounts.creator.key(),
        expiration_time,
        campaign_name: name,
        ipfs_id,
        aggregate_amount,
        recipient_count,
    });

    Ok(())
}
