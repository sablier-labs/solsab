use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::lockup::StreamData,
    utils::{
        constants::*, events::CancelLockupStream, lockup_math::get_streamed_amount, transfer_helper::transfer_tokens,
        validations::check_cancel,
    },
};

#[derive(Accounts)]
#[instruction(salt: u64)]
pub struct Cancel<'info> {
    #[account(
        mut,
        address = stream_data.sender,
    )]
    pub sender: Signer<'info>,

    #[account(address = stream_data.asset_mint)]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        seeds = [
          STREAM_NFT_MINT_SEED,
          sender.key().as_ref(),
          salt.to_le_bytes().as_ref(),
        ],
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
        associated_token::authority = stream_data,
        associated_token::token_program = deposit_token_program,
    )]
    pub stream_data_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = sender,
        associated_token::token_program = deposit_token_program,
    )]
    pub sender_asset_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub deposit_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Cancel>, salt: u64) -> Result<()> {
    // Retrieve the stream amounts from storage.
    let stream_amounts = ctx.accounts.stream_data.amounts.clone();

    // Calculate the streamed amount.
    let streamed_amount = get_streamed_amount(&ctx.accounts.stream_data.timestamps, &stream_amounts);

    // Check: validate the cancellation.
    check_cancel(
        ctx.accounts.stream_data.is_cancelable,
        ctx.accounts.stream_data.is_depleted,
        ctx.accounts.stream_data.was_canceled,
        streamed_amount,
        stream_amounts.deposited,
    )?;

    // Calculate the sender's amount.
    let sender_amount = stream_amounts.deposited - streamed_amount;

    // Calculate the recipient's amount.
    let recipient_amount = streamed_amount - stream_amounts.withdrawn;

    // Effect: update the stream data state.
    ctx.accounts.stream_data.cancel(sender_amount, recipient_amount)?;

    // Interaction: transfer the tokens from the Treasury ATA to the sender.
    transfer_tokens(
        ctx.accounts.stream_data_ata.to_account_info(),
        ctx.accounts.sender_asset_ata.to_account_info(),
        ctx.accounts.stream_data.to_account_info(),
        ctx.accounts.asset_mint.to_account_info(),
        ctx.accounts.deposit_token_program.to_account_info(),
        sender_amount,
        ctx.accounts.asset_mint.decimals,
        &[&[STREAM_DATA_SEED, &[ctx.accounts.stream_data.bump]]],
    )?;

    // Log the cancellation.
    emit!(CancelLockupStream { salt, asset_mint: ctx.accounts.asset_mint.key(), sender_amount, recipient_amount });

    Ok(())
}
