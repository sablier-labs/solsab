use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    state::lockup::StreamData,
    utils::{constants::*, lockup_math::get_streamed_amount},
};

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct StatusOf<'info> {
    #[account(
        seeds = [STREAM_NFT_MINT_SEED,
                 stream_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        seeds = [STREAM_DATA_SEED,
                 stream_nft_mint.key().as_ref()],
        bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,
}

pub fn handler(ctx: Context<StatusOf>, _stream_id: u64) -> Result<StreamStatus> {
    let stream_data = &ctx.accounts.stream_data;

    // TODO: also check for Stream Depletion

    if stream_data.was_canceled {
        return Ok(StreamStatus::Canceled);
    }

    // Get the current time
    let current_time = Clock::get()?.unix_timestamp;

    if current_time < stream_data.timestamps.start_time {
        return Ok(StreamStatus::Pending);
    }

    // Get the streamed amount
    let streamed_amount = get_streamed_amount(&stream_data.timestamps, &stream_data.amounts);

    if streamed_amount < stream_data.amounts.deposited {
        Ok(StreamStatus::Streaming)
    } else {
        Ok(StreamStatus::Settled)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum StreamStatus {
    Pending,
    Streaming,
    Settled,
    Canceled,
    Depleted,
}
