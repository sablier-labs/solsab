use anchor_lang::prelude::*;

use crate::{state::Treasury, utils::constants::seeds::TREASURY};

#[derive(Accounts)]
pub struct TreasuryView<'info> {
    // -------------------------------------------------------------------------- //
    //                              SABLIER ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the account storing the treasury details.
    #[account(
      seeds = [TREASURY],
      bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,
}
