use anchor_lang::prelude::*;

use crate::{
    state::{campaign::*, claim_status::*},
    utils::constants::*,
};

#[derive(Accounts)]
#[instruction(merkle_root: [u8; 32])]
pub struct HasClaimed<'info> {
    #[account(
      seeds = [CAMPAIGN_SEED, &merkle_root],
      bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
      seeds = [CLAIM_STATUS_SEED, &campaign.key().to_bytes()],
      bump
    )]
    pub claim_status: Account<'info, ClaimStatus>,
}

pub fn handler(ctx: Context<HasClaimed>, _merkle_root: [u8; 32], leaf_id: u32) -> Result<bool> {
    let claim_status = &ctx.accounts.claim_status;

    Ok(claim_status.claimed_bitmap[leaf_id as usize])
}
