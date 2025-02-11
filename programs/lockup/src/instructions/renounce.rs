use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{state::lockup::StreamData, utils::errors::ErrorCode};

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct Renounce<'info> {
    #[account(
        mut,
        constraint = sender.key() == stream_data.sender,
    )]
    pub sender: Signer<'info>,

    #[account(
        seeds = [b"stream_nft_mint",
                 stream_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"LL_stream", stream_nft_mint.key().as_ref()],
        bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,
}

pub fn handler(ctx: Context<Renounce>, _stream_id: u64) -> Result<()> {
    let stream_data = &mut ctx.accounts.stream_data;

    // Assert that the Stream is cancelable
    if !stream_data.is_cancelable {
        return Err(ErrorCode::StreamCancelabilityIsAlreadyRenounced.into());
    }

    // Mark the Stream as non-cancelable
    stream_data.is_cancelable = false;

    Ok(())
}
