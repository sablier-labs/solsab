use anchor_lang::prelude::*;

use crate::{
    state::{Campaign, ClaimReceipt},
    utils::constants::*,
};

#[derive(Accounts)]
#[instruction(_index: u32)]
pub struct HasClaimed<'info> {
    #[account()]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(
        seeds = [
            CLAIM_RECEIPT_SEED,
            campaign.key().as_ref(),
            _index.to_le_bytes().as_ref(),
        ],
        bump = claim_receipt.bump
    )]
    pub claim_receipt: Option<Account<'info, ClaimReceipt>>,
}
