use anchor_lang::prelude::*;

use super::CampaignView;
use crate::utils::validations::has_campaign_started;

pub fn handler(ctx: Context<CampaignView>) -> Result<bool> {
    has_campaign_started(ctx.accounts.campaign.campaign_start_time)
}
