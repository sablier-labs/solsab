use anchor_lang::prelude::*;
use mpl_core::accounts::BaseAssetV1;

use crate::{
    state::lockup::StreamData,
    utils::{
        constants::seeds::*, events::RenounceLockupStream, lockup_math::get_streamed_amount,
        validations::check_renounce,
    },
};

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

/// See the documentation for [`fn@crate::sablier_lockup::renounce`].
pub fn handler(ctx: Context<Renounce>) -> Result<()> {
    let stream_data = &ctx.accounts.stream_data;

    // Check: validate the renounce.
    check_renounce(
        stream_data.is_cancelable,
        stream_data.amounts.deposited,
        get_streamed_amount(
            &stream_data.model,
            &stream_data.amounts,
            stream_data.is_depleted,
            stream_data.was_canceled,
        ),
    )?;

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
