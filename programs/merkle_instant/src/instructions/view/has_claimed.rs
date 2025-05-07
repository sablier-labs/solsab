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
      bump = campaign.bump,
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(
      seeds = [CLAIM_STATUS_SEED, &campaign.key().to_bytes()],
      bump = claim_status.bump,
    )]
    pub claim_status: Box<Account<'info, ClaimStatus>>,
}

pub fn handler(ctx: Context<HasClaimed>, _merkle_root: [u8; 32], leaf_id: u32) -> Result<bool> {
    Ok(ctx.accounts.claim_status.claimed_bitmap[leaf_id as usize])
}
