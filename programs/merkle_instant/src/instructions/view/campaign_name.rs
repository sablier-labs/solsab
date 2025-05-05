use anchor_lang::prelude::*;

use super::CampaignView;

pub fn handler(ctx: Context<CampaignView>, _merkle_root: [u8; 32]) -> Result<String> {
    Ok(ctx.accounts.campaign.name.clone())
}
