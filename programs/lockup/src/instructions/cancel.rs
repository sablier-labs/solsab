use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    state::{lockup::StreamData, treasury::Treasury},
    utils::{errors::ErrorCode, streaming_math::get_refundable_amount},
};

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct Cancel<'info> {
    #[account(
        mut,
        constraint = sender.key() == stream_data.sender,
    )]
    pub sender: Signer<'info>,

    #[account(
        constraint = asset_mint.key() == stream_data.asset_mint,
    )]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

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

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = sender,
        associated_token::token_program = asset_token_program,
    )]
    pub sender_asset_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"treasury"],
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

pub fn handler(ctx: Context<Cancel>, _stream_id: u64) -> Result<()> {
    // Assert that the Stream is cancelable
    if !ctx.accounts.stream_data.is_cancelable {
        return Err(ErrorCode::StreamIsNotCancelable.into());
    }

    // Clone the milestones to avoid immutable borrow conflicts
    let milestones = ctx.accounts.stream_data.milestones.clone();

    // Mutably borrow the stream amounts
    let stream_amounts = &mut ctx.accounts.stream_data.amounts;

    // Calculate the refundable amount
    let refundable_amount = get_refundable_amount(&milestones, stream_amounts);

    if refundable_amount > 0 {
        // Prepare the instruction to transfer the refundable SPL tokens back to the sender
        let transfer_ix = TransferChecked {
            from: ctx.accounts.treasury_ata.to_account_info(),
            mint: ctx.accounts.asset_mint.to_account_info(),
            to: ctx.accounts.sender_asset_ata.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };

        // Wrap the Treasury PDA's seeds in the appropriate structure
        let signer_seeds: &[&[&[u8]]] = &[&[b"treasury", &[ctx.accounts.treasury.bump]]];

        // Execute the transfer
        let cpi_ctx =
            CpiContext::new_with_signer(ctx.accounts.asset_token_program.to_account_info(), transfer_ix, signer_seeds);
        transfer_checked(cpi_ctx, refundable_amount, ctx.accounts.asset_mint.decimals)?;

        // Update the Stream field tracking the refunded amount
        stream_amounts.refunded = refundable_amount;
    }

    // Mark the Stream as canceled
    ctx.accounts.stream_data.was_canceled = true;

    // Mark the Stream as non-cancelable
    ctx.accounts.stream_data.is_cancelable = false;

    Ok(())
}
