use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{state::lockup::StreamData, utils::constants::*};

// Common context that is used by multiple view instructions
#[derive(Accounts)]
pub struct StreamView<'info> {
    #[account()]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      seeds = [
        STREAM_DATA_SEED,
        stream_nft_mint.key().as_ref()
      ],
      bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,
}
