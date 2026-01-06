use anchor_lang::prelude::*;
use mpl_core::accounts::BaseAssetV1;

use crate::{
    state::lockup::StreamData,
    utils::{constants::seeds::STREAM_DATA, events::RenounceLockupStream, validations::check_renounce},
};

// -------------------------------------------------------------------------- //
//                                IX ACCOUNTS                                 //
// -------------------------------------------------------------------------- //

#[derive(Accounts)]
pub struct Renounce<'info> {
    // -------------------------------------------------------------------------- //
    //                               USER ACCOUNTS                                //
    // -------------------------------------------------------------------------- //
    /// Write account: the sender of the stream.
    #[account(address = stream_data.sender)]
    pub sender: Signer<'info>,

    // -------------------------------------------------------------------------- //
    //                               STREAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Write account: the stream data account storing stream details.
    #[account(
      mut,
      seeds = [STREAM_DATA, stream_nft.key().as_ref()],
      bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    /// Read account: the NFT representing the stream.
    pub stream_nft: Box<Account<'info, BaseAssetV1>>,
}

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_lockup::renounce`].
pub fn handler(ctx: Context<Renounce>) -> Result<()> {
    // Check: validate the renounce.
    check_renounce(&ctx.accounts.stream_data)?;

    // Effect: update the stream data state.
    ctx.accounts.stream_data.renounce()?;

    // Log the renouncement.
    emit!(RenounceLockupStream {
        deposited_token_mint: ctx.accounts.stream_data.deposited_token_mint,
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft: ctx.accounts.stream_nft.key(),
    });

    Ok(())
}
