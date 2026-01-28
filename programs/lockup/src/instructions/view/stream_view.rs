use anchor_lang::prelude::*;
use mpl_core::accounts::BaseAssetV1;

use crate::{state::lockup::StreamData, utils::constants::seeds::STREAM_DATA};

// -------------------------------------------------------------------------- //
//                                IX ACCOUNTS                                 //
// -------------------------------------------------------------------------- //

/// Common context that is used by multiple view instructions.
#[derive(Accounts)]
pub struct StreamView<'info> {
    // -------------------------------------------------------------------------- //
    //                               STREAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the account storing stream details.
    #[account(
      seeds = [
        STREAM_DATA,
        stream_nft.key().as_ref()
      ],
      bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    /// Read account: the NFT representing the stream.
    #[account(address = stream_data.nft_address)]
    pub stream_nft: Box<Account<'info, BaseAssetV1>>,
}
