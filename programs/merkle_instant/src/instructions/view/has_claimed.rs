use anchor_lang::prelude::*;

use crate::{state::campaign::*, utils::constants::*};

#[derive(Accounts)]
#[instruction(merkle_root: [u8; 32])]
pub struct HasClaimed<'info> {
    #[account(
      seeds = [CAMPAIGN_SEED, &merkle_root],
      bump = campaign.bump,
    )]
    pub campaign: Box<Account<'info, Campaign>>,
}

pub fn handler(ctx: Context<HasClaimed>, _merkle_root: [u8; 32], leaf_id: u32) -> Result<bool> {
    // TODO: What if the leaf_id is out of bounds?
    Ok(ctx.accounts.campaign.claim_status[leaf_id as usize])
}
