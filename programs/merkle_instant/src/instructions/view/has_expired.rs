use anchor_lang::prelude::*;

use super::CampaignView;
use crate::utils::validations::has_expired;

pub fn handler(ctx: Context<CampaignView>) -> Result<bool> {
    has_expired(ctx.accounts.campaign.expiration_time)
}
