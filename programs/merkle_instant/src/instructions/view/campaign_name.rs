use anchor_lang::prelude::*;

use super::CampaignView;

pub fn handler(ctx: Context<CampaignView>) -> Result<String> {
    Ok(ctx.accounts.campaign.name.clone())
}
