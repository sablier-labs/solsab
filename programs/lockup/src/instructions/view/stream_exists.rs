use anchor_lang::prelude::*;
use mpl_core::accounts::BaseAssetV1;

use crate::utils::constants::seeds::STREAM_NFT;

#[derive(Accounts)]
#[instruction(_sender: Pubkey, _salt: u128)]
pub struct StreamExists<'info> {
    // -------------------------------------------------------------------------- //
    //                               STREAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the NFT representing the stream.
    #[account(
      seeds = [
        STREAM_NFT,
        _sender.as_ref(),
        _salt.to_le_bytes().as_ref(),
      ],
      bump
    )]
    pub stream_nft: Box<Account<'info, BaseAssetV1>>,
}
