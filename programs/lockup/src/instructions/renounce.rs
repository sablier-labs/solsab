use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    state::lockup::StreamData,
    utils::{
        constants::seeds::STREAM_DATA, events::RenounceLockupStream, lockup_math::get_streamed_amount,
        validations::check_renounce,
    },
};

#[derive(Accounts)]
pub struct Renounce<'info> {
    #[account(
      mut,
      address = stream_data.sender,
    )]
    pub sender: Signer<'info>,

    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      mut,
      seeds = [
        STREAM_DATA,
        stream_nft_mint.key().as_ref()
      ],
      bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,
}

pub fn handler(ctx: Context<Renounce>) -> Result<()> {
    // Check: validate the renounce.
    check_renounce(
        ctx.accounts.stream_data.is_cancelable,
        ctx.accounts.stream_data.amounts.deposited,
        get_streamed_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts),
    )?;

    // Effect: update the stream data state.
    ctx.accounts.stream_data.renounce()?;

    // Log the renouncement.
    emit!(RenounceLockupStream {
        deposited_token_mint: ctx.accounts.stream_data.deposited_token_mint,
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft_mint: ctx.accounts.stream_nft_mint.key(),
    });

    Ok(())
}
