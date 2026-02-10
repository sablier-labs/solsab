use anchor_lang::prelude::*;

use crate::utils::constants::seeds::STREAM_NFT;

// -------------------------------------------------------------------------- //
//                                IX ACCOUNTS                                 //
// -------------------------------------------------------------------------- //

#[derive(Accounts)]
#[instruction(_sender: Pubkey, _salt: u128)]
pub struct StreamExists<'info> {
    // -------------------------------------------------------------------------- //
    //                               STREAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the NFT representing the stream.
    /// CHECK: If it exists, return true, otherwise false.
    #[account(
      seeds = [
        STREAM_NFT,
        _sender.as_ref(),
        _salt.to_le_bytes().as_ref(),
      ],
      bump
    )]
    pub stream_nft: UncheckedAccount<'info>,
}
