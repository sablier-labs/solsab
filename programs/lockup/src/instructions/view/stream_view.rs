use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{state::lockup::StreamData, utils::constants::seeds::STREAM_DATA};

// Common context that is used by multiple view instructions
#[derive(Accounts)]
pub struct StreamView<'info> {
    // -------------------------------------------------------------------------- //
    //                               STREAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the account storing stream details.
    #[account(
      seeds = [
        STREAM_DATA,
        stream_nft_mint.key().as_ref()
      ],
      bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    /// Read account: the mint account for the stream NFT.
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,
}
