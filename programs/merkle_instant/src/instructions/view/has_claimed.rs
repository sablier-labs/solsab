use anchor_lang::prelude::*;

use crate::{state::Campaign, utils::constants::seeds::CLAIM_RECEIPT};

#[derive(Accounts)]
#[instruction(_index: u32)]
pub struct HasClaimed<'info> {
    // -------------------------------------------------------------------------- //
    //                                CAMPAIGN ACCOUNTS                           //
    // -------------------------------------------------------------------------- //
    /// Read account: the account storing the campaign data.
    pub campaign: Box<Account<'info, Campaign>>,

    /// Read account: the claim receipt.
    /// CHECK: If it exists, return true, otherwise false.
    #[account(
        seeds = [
            CLAIM_RECEIPT,
            campaign.key().as_ref(),
            _index.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub claim_receipt: UncheckedAccount<'info>,
}
