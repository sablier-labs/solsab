use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{lockup::StreamData, treasury::Treasury},
    utils::{
        constants::*, events::CancelLockupStream, lockup_math::get_streamed_amount, transfer_helper::transfer_tokens,
        validations::check_cancel,
    },
};

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct Cancel<'info> {
    #[account(
        mut,
        address = stream_data.sender,
    )]
    pub sender: Signer<'info>,

    #[account(address = stream_data.asset_mint)]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

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

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = sender,
        associated_token::token_program = asset_token_program,
    )]
    pub sender_asset_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = treasury,
        associated_token::token_program = asset_token_program,
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub asset_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Cancel>) -> Result<()> {
    // Retrieve the stream amounts from storage.
    let stream_amounts = ctx.accounts.stream_data.amounts.clone();

    // Calculate the streamed amount.
    let streamed_amount = get_streamed_amount(&ctx.accounts.stream_data.milestones, &stream_amounts);

    // Check: validate the cancellation.
    check_cancel(
        ctx.accounts.stream_data.is_cancelable,
        ctx.accounts.stream_data.was_canceled,
        streamed_amount,
        stream_amounts.deposited,
    )?;

    // Calculate the sender's amount.
    let sender_amount = stream_amounts.deposited - streamed_amount;

    // Effect: update the stream data state.
    ctx.accounts.stream_data.cancel(sender_amount)?;

    // Interaction: transfer the tokens from the Treasury ATA to the sender.
    transfer_tokens(
        ctx.accounts.treasury_ata.to_account_info(),
        ctx.accounts.sender_asset_ata.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
        ctx.accounts.asset_mint.to_account_info(),
        ctx.accounts.asset_token_program.to_account_info(),
        sender_amount,
        ctx.accounts.asset_mint.decimals,
        &[&[TREASURY_SEED, &[ctx.accounts.treasury.bump]]],
    )?;

    // Log the cancellation.
    emit!(CancelLockupStream { stream_id: ctx.accounts.stream_data.id, refunded_amount: sender_amount });

    Ok(())
}
