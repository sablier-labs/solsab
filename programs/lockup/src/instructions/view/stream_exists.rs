use anchor_lang::prelude::*;

use crate::utils::constants::seeds::STREAM_NFT_MINT;

#[derive(Accounts)]
#[instruction(_sender: Pubkey, _salt: u128)]
pub struct StreamExists<'info> {
    // -------------------------------------------------------------------------- //
    //                               STREAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the mint account for the stream NFT.
    /// CHECK: If it exists, return true, otherwise false.
    #[account(
      seeds = [
        STREAM_NFT_MINT,
        _sender.as_ref(),
        _salt.to_le_bytes().as_ref(),
      ],
      bump
    )]
    pub stream_nft_mint: UncheckedAccount<'info>,
}
