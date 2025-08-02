use anchor_lang::prelude::*;

use crate::state::Campaign;

// Common context used by multiple view instructions
#[derive(Accounts)]
pub struct CampaignView<'info> {
    // -------------------------------------------------------------------------- //
    //                               CAMPAIGN ACCOUNTS                            //
    // -------------------------------------------------------------------------- //
    /// Read account: the account storing the campaign data.
    pub campaign: Box<Account<'info, Campaign>>,
}

/// See the documentation for [`crate::sablier_merkle_instant::campaign_view`].
pub fn handler(ctx: Context<CampaignView>) -> Result<Campaign> {
    Ok(ctx.accounts.campaign.clone().into_inner())
}
