use anchor_lang::prelude::*;

use crate::{state::Campaign, utils::constants::*};

#[derive(Accounts)]
#[instruction(_index: u32)]
pub struct HasClaimed<'info> {
    pub campaign: Box<Account<'info, Campaign>>,

    /// CHECK: If it exists, return true, otherwise false.
    #[account(
        seeds = [
            CLAIM_RECEIPT_SEED,
            campaign.key().as_ref(),
            _index.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub claim_receipt: UncheckedAccount<'info>,
}
