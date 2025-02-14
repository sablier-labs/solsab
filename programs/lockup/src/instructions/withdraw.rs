use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    state::{lockup::StreamData, treasury::Treasury},
    utils::{errors::ErrorCode, streaming_math::get_withdrawable_amount},
};

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        constraint = asset_mint.key() == stream_data.asset_mint,
    )]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        constraint = recipient.key() == stream_data.recipient,
    )]
    /// CHECK: This account may only be the Stream's recipient
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = asset_mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program,
    )]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

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
        seeds = [b"treasury"],
        bump = treasury_pda.bump
    )]
    pub treasury_pda: Box<Account<'info, Treasury>>,

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Withdraw>, _stream_id: u64, amount: u64) -> Result<()> {
    // Assert that the withdrawn amount is not zero
    if amount == 0 {
        return Err(ErrorCode::WithdrawalAmountCannotBeZero.into());
    }

    // Calculate the withdrawable amount
    let withdrawable_amount = get_withdrawable_amount(
        &ctx.accounts.stream_data.milestones,
        ctx.accounts.stream_data.amounts.deposited,
        ctx.accounts.stream_data.amounts.withdrawn,
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
        mint: ctx.accounts.asset_mint.to_account_info(),
        to: ctx.accounts.recipient_ata.to_account_info(),
        authority: treasury_pda.to_account_info(),
    };

    // Wrap the Treasury PDA's seeds in the appropriate structure
    let signer_seeds: &[&[&[u8]]] = &[&[b"treasury", &[treasury_pda.bump]]];

    // Execute the transfer
    let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), transfer_ix, signer_seeds);
    transfer_checked(cpi_ctx, amount, ctx.accounts.asset_mint.decimals)?;

    let stream_amounts = &mut ctx.accounts.stream_data.amounts;

    // Update the Stream's withdrawn amount
    stream_amounts.withdrawn = stream_amounts.withdrawn.checked_add(amount).expect("Withdrawn amount overflow");

    // Mark the Stream as non-cancelable if it has been depleted
    //
    // Note: the `>=` operator is used as an extra safety measure for the case when the withdrawn amount is bigger than
    // expected, for one reason or the other
    if stream_amounts.withdrawn >= stream_amounts.deposited - stream_amounts.refunded {
        ctx.accounts.stream_data.is_cancelable = false;
    }

    Ok(())
}
