use anchor_lang::prelude::*;

use crate::state::Campaign;

// Common context used by multiple view instructions
#[derive(Accounts)]
pub struct CampaignView<'info> {
    // -------------------------------------------------------------------------- //
    //                               CAMPAIGN ACCOUNTS                            //
    // -------------------------------------------------------------------------- //
    pub campaign: Box<Account<'info, Campaign>>,
}

pub fn handler(ctx: Context<CampaignView>) -> Result<Campaign> {
    Ok(ctx.accounts.campaign.clone().into_inner())
}
