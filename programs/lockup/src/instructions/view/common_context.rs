use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{state::lockup::StreamData, utils::constants::*};

// Common context that can be used for multiple view instructions
#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct StreamViewContext<'info> {
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
