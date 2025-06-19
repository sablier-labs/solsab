use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::lockup::StreamData,
    utils::{
        constants::seeds::STREAM_DATA, events::CancelLockupStream, lockup_math::get_streamed_amount,
        transfer_helper::transfer_tokens, validations::check_cancel,
    },
};

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
      mut,
      address = stream_data.sender,
    )]
    pub sender: Signer<'info>,

    #[account(address = stream_data.deposited_token_mint)]
    pub deposited_token_mint: Box<InterfaceAccount<'info, Mint>>,

    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      mut,
      seeds = [
        STREAM_DATA,
        stream_nft_mint.key().as_ref()
      ],
      bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    #[account(
        mut,
        associated_token::mint = deposited_token_mint,
        associated_token::authority = stream_data,
        associated_token::token_program = deposited_token_program,
    )]
    pub stream_data_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = deposited_token_mint,
        associated_token::authority = sender,
        associated_token::token_program = deposited_token_program,
    )]
    pub sender_asset_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub deposited_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Cancel>) -> Result<()> {
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
        ctx.accounts.deposited_token_mint.to_account_info(),
        ctx.accounts.deposited_token_program.to_account_info(),
        sender_amount,
        ctx.accounts.deposited_token_mint.decimals,
        &[&[STREAM_DATA, ctx.accounts.stream_nft_mint.key().as_ref(), &[ctx.accounts.stream_data.bump]]],
    )?;

    // Log the cancellation.
    emit!(CancelLockupStream {
        deposited_token_mint: ctx.accounts.deposited_token_mint.key(),
        recipient_amount,
        sender_amount,
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft_mint: ctx.accounts.stream_nft_mint.key()
    });

    Ok(())
}
