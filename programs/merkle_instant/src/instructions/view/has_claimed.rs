use anchor_lang::prelude::*;

use crate::{
    state::{campaign::Campaign, claim_status::ClaimStatus},
    utils::constants::*,
};

#[derive(Accounts)]
#[instruction(_merkle_root: [u8; 32], _index: u32)]
pub struct HasClaimed<'info> {
    #[account(address = campaign.creator)]
    /// CHECK: This account is validated through the constraint `address = campaign.creator`
    pub creator: UncheckedAccount<'info>,

    #[account()]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(
        seeds = [
            CLAIM_STATUS_SEED,
            campaign.key().as_ref(),
            _index.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub claim_status: Option<Account<'info, ClaimStatus>>,
}
