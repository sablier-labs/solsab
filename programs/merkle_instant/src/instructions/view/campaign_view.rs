use anchor_lang::prelude::*;

use crate::state::campaign::*;

// Common context that is used by multiple view instructions
#[derive(Accounts)]
pub struct CampaignView<'info> {
    #[account()]
    /// CHECK: This is a view function
    pub campaign: Box<Account<'info, Campaign>>,
}
