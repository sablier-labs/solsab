use anchor_lang::prelude::*;

use super::CampaignView;
use crate::utils::validations::has_started;

pub fn handler(ctx: Context<CampaignView>) -> Result<bool> {
    has_started(ctx.accounts.campaign.start_time)
}
