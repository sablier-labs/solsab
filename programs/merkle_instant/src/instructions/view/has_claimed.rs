use anchor_lang::prelude::*;

use crate::{
    state::{Campaign, ClaimStatus},
    utils::constants::*,
};

#[derive(Accounts)]
#[instruction(_index: u32)]
pub struct HasClaimed<'info> {
    #[account()]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(
        seeds = [
            CLAIM_STATUS_SEED,
            campaign.key().as_ref(),
            _index.to_le_bytes().as_ref(),
        ],
        bump = claim_status.bump
    )]
    pub claim_status: Option<Account<'info, ClaimStatus>>,
}
