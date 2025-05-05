use anchor_lang::prelude::*;

use crate::{state::campaign::*, utils::constants::*};

// Common context that is used by multiple view instructions
#[derive(Accounts)]
#[instruction(merkle_root: [u8; 32])]
pub struct CampaignView<'info> {
    #[account(
      seeds = [CAMPAIGN_SEED, &merkle_root],
      bump
    )]
    pub campaign: Account<'info, Campaign>,
}
