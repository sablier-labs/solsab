use anchor_lang::prelude::*;

use crate::{state::campaign::*, utils::constants::*};

// Common context that is used by multiple view instructions
#[derive(Accounts)]
#[instruction(_merkle_root: [u8; 32])]
pub struct CampaignView<'info> {
    #[account(address = campaign.creator)]
    /// CHECK: This account is validated through the constraint `address = campaign.creator`
    pub creator: UncheckedAccount<'info>,

    #[account(
      seeds = [
        CAMPAIGN_SEED,
        creator.key().as_ref(),
        _merkle_root.as_ref()
     ],
     bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,
}
