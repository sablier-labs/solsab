use anchor_lang::prelude::*;

use super::CampaignView;
use crate::utils::validations::has_expired;

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_merkle_instant::has_expired`].
pub fn handler(ctx: Context<CampaignView>) -> Result<bool> {
    has_expired(ctx.accounts.campaign.expiration_time)
}
