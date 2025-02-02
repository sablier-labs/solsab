use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    state::{lockup::Stream, treasury::Treasury},
    utils::{errors::ErrorCode, streaming_math::get_withdrawable_amount},
};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"LL_stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        bump = stream.bump
    )]
    pub stream: Box<Account<'info, Stream>>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
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
        associated_token::token_program = token_program
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Assert that the withdrawn amount is not zero
    if amount == 0 {
        return Err(ErrorCode::WithdrawalAmountCannotBeZero.into());
    }

    // Calculate the withdrawable amount
    let withdrawable_amount = get_withdrawable_amount(
        &ctx.accounts.stream.milestones,
        ctx.accounts.stream.amounts.deposited,
        ctx.accounts.stream.amounts.withdrawn,
    );

    // Assert that the withdrawable amount is not too big
    if amount > withdrawable_amount {
        return Err(ErrorCode::InvalidWithdrawalAmount.into());
    }

    let treasury_pda = &mut ctx.accounts.treasury_pda;

    // Transfer the withdrawable SPL tokens to the recipient
    // Prepare the transfer instruction
    let transfer_ix = TransferChecked {
        from: ctx.accounts.treasury_ata.to_account_info().clone(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.recipient_ata.to_account_info(),
        authority: treasury_pda.to_account_info(),
    };

    // Wrap the Treasury PDA's seeds in the appropriate structure
    let signer_seeds: &[&[&[u8]]] = &[&[b"treasury", &[treasury_pda.bump]]];

    // Execute the transfer
    let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), transfer_ix, signer_seeds);
    transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    let stream_amounts = &mut ctx.accounts.stream.amounts;

    // Update the Stream's withdrawn amount
    stream_amounts.withdrawn = stream_amounts.withdrawn.checked_add(amount).expect("Withdrawn amount overflow");

    // Mark the Stream as non-cancelable if it has been depleted
    //
    // Note: the `>=` operator is used as an extra safety measure for the case when the withdrawn amount is bigger than
    // expected, for one reason or the other
    if stream_amounts.withdrawn >= stream_amounts.deposited - stream_amounts.refunded {
        ctx.accounts.stream.is_cancelable = false;
    }

    Ok(())
}
