use anchor_lang::prelude::*;

use crate::state::Campaign;

// -------------------------------------------------------------------------- //
//                                IX ACCOUNTS                                 //
// -------------------------------------------------------------------------- //

/// Common context used by multiple view instructions.
#[derive(Accounts)]
pub struct CampaignView<'info> {
    // -------------------------------------------------------------------------- //
    //                               CAMPAIGN ACCOUNTS                            //
    // -------------------------------------------------------------------------- //
    /// Read account: the account storing the campaign data.
    pub campaign: Box<Account<'info, Campaign>>,
}
