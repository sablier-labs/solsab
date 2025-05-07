use anchor_lang::prelude::*;

use super::CampaignView;

pub fn handler(ctx: Context<CampaignView>, _merkle_root: [u8; 32]) -> Result<bool> {
    let current_time = Clock::get()?.unix_timestamp;
    Ok(current_time >= ctx.accounts.campaign.expiration_time)
}
