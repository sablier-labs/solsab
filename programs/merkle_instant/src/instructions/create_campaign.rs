use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{campaign::Campaign, claim_status::ClaimStatus},
    utils::{
        constants::{ANCHOR_DISCRIMINATOR_SIZE, CAMPAIGN_SEED, CLAIM_STATUS_SEED},
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

    #[account(
      init,
      payer = campaign_creator,
      seeds = [CLAIM_STATUS_SEED, &campaign.key().to_bytes()],
      space = ANCHOR_DISCRIMINATOR_SIZE + ClaimStatus::INIT_SPACE,
      bump
    )]
    pub claim_status: Box<Account<'info, ClaimStatus>>,

    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateCampaign>,
    name: String,
    // TODO: if the passed no_of_recipients is smaller than the actual number of Merkle Tree leaves, a double-spend
    // attack is possible (claiming the allocation multiple times by the same recipient with an id >
    // no_of_recipients). How do we prevent this?
    // + write a test confirming that this attack is not possible - and the claim Ix execution fails when trying to
    //   update the Claim Status of the respective airdrop recipient.
    no_of_recipients: u32,
    merkle_tree_ipfs_id: String,
    merkle_root: [u8; 32],
    expiration_time: i64,
) -> Result<()> {
    // Check: validate the campaign creation.
    check_create_campaign(expiration_time)?;

    // Effect: Initialize the campaign account.
    ctx.accounts.campaign.initialize(
        ctx.bumps.campaign,
        name.clone(),
        ctx.accounts.airdrop_token_mint.key(),
        merkle_tree_ipfs_id.clone(),
        merkle_root,
        expiration_time,
        ctx.accounts.campaign_creator.key(),
    )?;

    // Effect: Initialize the claim status account.
    ctx.accounts.claim_status.initialize(ctx.bumps.claim_status, no_of_recipients)?;

    // Log the campaign creation.
    emit!(CampaignCreated {
        campaign: ctx.accounts.campaign.key(),
        creator: ctx.accounts.campaign_creator.key(),
        campaign_name: name,
        no_of_recipients,
        merkle_tree_ipfs_id,
        merkle_root,
        expiration_time,
    });

    Ok(())
}
