use anchor_lang::prelude::*;

use crate::state::Campaign;

// Common context that is used by multiple view instructions
#[derive(Accounts)]
pub struct CampaignView<'info> {
    #[account()]
    pub campaign: Box<Account<'info, Campaign>>,
}

pub fn handler(ctx: Context<CampaignView>) -> Result<Campaign> {
    Ok(ctx.accounts.campaign.clone().into_inner())
}
