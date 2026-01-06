use anchor_lang::prelude::*;

use super::CampaignView;
use crate::utils::validations::has_grace_period_passed;

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_merkle_instant::has_grace_period_passed`].
pub fn handler(ctx: Context<CampaignView>) -> Result<bool> {
    has_grace_period_passed(ctx.accounts.campaign.expiration_time)
}
