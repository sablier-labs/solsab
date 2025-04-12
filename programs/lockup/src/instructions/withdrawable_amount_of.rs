use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    state::lockup::StreamData,
    utils::{constants::*, events::*, lockup_math::get_withdrawable_amount},
};

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct WithdrawableAmountOf<'info> {
    // #[account(mut)]
    // pub signer: Signer<'info>, // TODO: try removing this account, given that this is a "read-only" Ix
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

pub fn handler(ctx: Context<WithdrawableAmountOf>, stream_id: u64) -> Result<u64> {
    let amount = get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts);

    // Emit an event indicating that the withdrawable amount has been queried
    emit!(WithdrawableAmountQueried { stream_id, withdrawable_amount: amount });

    Ok(amount)
}
