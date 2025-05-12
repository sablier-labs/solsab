use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    state::lockup::StreamData,
    utils::{constants::*, events::RenounceLockupStream, validations::check_renounce},
};

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct Renounce<'info> {
    #[account(
      mut,
      address = stream_data.sender,
    )]
    pub sender: Signer<'info>,

    #[account(
        seeds = [
          STREAM_NFT_MINT_SEED,
          sender.key().as_ref(),
          stream_id.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      mut,
      seeds = [
        STREAM_DATA_SEED,
        stream_nft_mint.key().as_ref()
      ],
      bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,
}

pub fn handler(ctx: Context<Renounce>, stream_id: u64) -> Result<()> {
    // Check: validate the renounce.
    check_renounce(ctx.accounts.stream_data.is_cancelable)?;

    // Effect: update the stream data state.
    ctx.accounts.stream_data.renounce()?;

    // Log the renouncement.
    emit!(RenounceLockupStream { stream_id });

    Ok(())
}
