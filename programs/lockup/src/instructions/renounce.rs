use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    state::lockup::StreamData,
    utils::{constants::*, errors::ErrorCode, events::StreamRenouncement},
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
        seeds = [STREAM_NFT_MINT_SEED,
                 stream_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [STREAM_DATA_SEED, stream_nft_mint.key().as_ref()],
        bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,
}

pub fn handler(ctx: Context<Renounce>) -> Result<()> {
    let stream_data = &mut ctx.accounts.stream_data;

    // Assert that the Stream is cancelable
    if !stream_data.is_cancelable {
        return Err(ErrorCode::StreamCancelabilityIsAlreadyRenounced.into());
    }

    // Mark the Stream as non-cancelable
    stream_data.is_cancelable = false;

    // Emit an event indicating that the sender has renounced the cancelability of the Stream
    msg!("The Stream with ID {} has been renounced", stream_data.id);
    emit!(StreamRenouncement { stream_id: stream_data.id });

    Ok(())
}
