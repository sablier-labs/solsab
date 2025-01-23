use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    state::{lockup_stream::Stream, treasury::Treasury},
    utils::{errors::ErrorCode, streaming_math::get_streamed_amount},
};

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [b"LL_stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        bump = stream.bump
    )]
    pub stream: Box<Account<'info, Stream>>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = sender_ata.owner == sender.key(),
    )]
    pub sender_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury_pda.bump
    )]
    pub treasury_pda: Box<Account<'info, Treasury>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program,
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Cancel>) -> Result<()> {
    let stream = &mut ctx.accounts.stream;
    let sender_ata = &ctx.accounts.sender_ata;
    let treasury_ata = &ctx.accounts.treasury_ata;
    let treasury_pda = &ctx.accounts.treasury_pda;
    let mint = &ctx.accounts.mint;

    // Assert that the Stream is cancelable
    if !stream.is_cancelable {
        return Err(ErrorCode::StreamIsNotCancelable.into());
    }

    // Calculate the refundable amount
    let refundable_amount = stream.amounts.deposited - get_streamed_amount(stream.milestones, stream.amounts.deposited);

    if refundable_amount > 0 {
        // Prepare the instruction to transfer the refundable SPL tokens back to the sender
        let transfer_ix = TransferChecked {
            from: treasury_ata.to_account_info(),
            mint: mint.to_account_info(),
            to: sender_ata.to_account_info(),
            authority: treasury_pda.to_account_info(),
        };

        // Wrap the Treasury PDA's seeds in the appropriate structure
        let signer_seeds: &[&[&[u8]]] = &[&[b"treasury", &[ctx.accounts.treasury_pda.bump]]];

        // Execute the transfer
        let cpi_ctx =
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), transfer_ix, signer_seeds);
        transfer_checked(cpi_ctx, refundable_amount, mint.decimals)?;

        // Update the Stream field tracking the refunded amount
        stream.amounts.refunded = refundable_amount;
    }

    // Dev: We're not sending the streamed amount to the recipient to prevent a potential misuse by transferring the
    // Stream to a censored address (e.g. Tornado Cash) after the cancelation intent is known.

    // Mark the Stream as canceled
    stream.was_canceled = true;

    // Mark the Stream as non-cancelable
    stream.is_cancelable = false;

    Ok(())
}
