use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    state::lockup::StreamData,
    utils::{constants::*, lockup_math::get_withdrawable_amount},
};

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct WithdrawableAmountOf<'info> {
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

pub fn handler(ctx: Context<WithdrawableAmountOf>, _stream_id: u64) -> Result<u64> {
    Ok(get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts))
}
