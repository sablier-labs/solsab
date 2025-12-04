// Example: Complete Anchor instruction with all key patterns
// From: programs/lockup/src/instructions/withdraw.rs

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{lockup::StreamData, treasury::Treasury},
    utils::{
        constants::seeds::*, events::WithdrawFromLockupStream, lockup_math::get_withdrawable_amount,
        transfer_helper::transfer_tokens, validations::check_withdraw,
    },
};

// ============================================================================
// ACCOUNT STRUCT: Organized by logical category
// ============================================================================

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // ------------------------------------------------------------------------ //
    //                              USER ACCOUNTS                               //
    // ------------------------------------------------------------------------ //
    /// Write account: transaction signer who pays fees
    #[account(mut)]
    pub signer: Signer<'info>,

    /// CHECK: Validated via constraint on recipient_stream_nft_ata
    pub stream_recipient: UncheckedAccount<'info>,

    /// CHECK: Custom constraint allows recipient or authorized withdrawal
    #[account(constraint = (
        withdrawal_recipient.key() == stream_recipient.key() ||
        (withdrawal_recipient.key() != stream_recipient.key() &&
         signer.key() == stream_recipient.key())
    ))]
    pub withdrawal_recipient: UncheckedAccount<'info>,

    /// Init-if-needed pattern: create ATA on first withdrawal
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::authority = withdrawal_recipient,
        associated_token::mint = deposited_token_mint,
        associated_token::token_program = deposited_token_program,
    )]
    pub withdrawal_recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // ------------------------------------------------------------------------ //
    //                            PROTOCOL ACCOUNTS                             //
    // ------------------------------------------------------------------------ //
    /// Treasury PDA: fee collection + configuration storage
    #[account(
        mut,
        seeds = [TREASURY],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    // ------------------------------------------------------------------------ //
    //                             ENTITY ACCOUNTS                              //
    // ------------------------------------------------------------------------ //
    /// Address constraint: must match stored mint in stream_data
    #[account(address = stream_data.deposited_token_mint)]
    pub deposited_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// NFT ownership verification: recipient must hold exactly 1 NFT
    #[account(
        associated_token::authority = stream_recipient,
        associated_token::mint = stream_nft_mint,
        associated_token::token_program = nft_token_program,
        constraint = recipient_stream_nft_ata.amount == 1,
    )]
    pub recipient_stream_nft_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Stream data PDA: derived from NFT mint
    #[account(
        mut,
        seeds = [STREAM_DATA, stream_nft_mint.key().as_ref()],
        bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    /// Stream's token vault
    #[account(
        mut,
        associated_token::authority = stream_data,
        associated_token::mint = deposited_token_mint,
        associated_token::token_program = deposited_token_program,
    )]
    pub stream_data_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    // ------------------------------------------------------------------------ //
    //                            PROGRAM ACCOUNTS                              //
    // ------------------------------------------------------------------------ //
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: Validated via address constraint against treasury
    #[account(address = treasury.chainlink_program)]
    pub chainlink_program: AccountInfo<'info>,

    /// CHECK: Chainlink price feed for fee calculation
    #[account(address = treasury.chainlink_sol_usd_feed)]
    pub chainlink_sol_usd_feed: AccountInfo<'info>,

    /// Interface: supports both Token and Token2022
    pub deposited_token_program: Interface<'info, TokenInterface>,
    pub nft_token_program: Interface<'info, TokenInterface>,

    // ------------------------------------------------------------------------ //
    //                             SYSTEM ACCOUNTS                              //
    // ------------------------------------------------------------------------ //
    pub system_program: Program<'info, System>,
}

// ============================================================================
// HANDLER
// ============================================================================

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Validate business logic
    check_withdraw(
        ctx.accounts.stream_data.is_depleted,
        amount,
        get_withdrawable_amount(
            &ctx.accounts.stream_data.timestamps,
            &ctx.accounts.stream_data.amounts,
            ctx.accounts.stream_data.is_depleted,
            ctx.accounts.stream_data.was_canceled,
        ),
    )?;

    // Update internal state
    ctx.accounts.stream_data.withdraw(amount)?;

    // Charge withdrawal fee
    let fee_in_lamports = charge_withdrawal_fee(
        ctx.accounts.chainlink_program.to_account_info(),
        ctx.accounts.chainlink_sol_usd_feed.to_account_info(),
        ctx.accounts.signer.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
    )?;

    // Transfer tokens from stream ATA to recipient
    transfer_tokens(
        ctx.accounts.stream_data_ata.to_account_info(),
        ctx.accounts.withdrawal_recipient_ata.to_account_info(),
        ctx.accounts.stream_data.to_account_info(),
        ctx.accounts.deposited_token_mint.to_account_info(),
        ctx.accounts.deposited_token_program.to_account_info(),
        amount,
        ctx.accounts.deposited_token_mint.decimals,
        // PDA signer seeds for CPI
        &[&[STREAM_DATA, ctx.accounts.stream_nft_mint.key().as_ref(), &[ctx.accounts.stream_data.bump]]],
    )?;

    // Emit event for indexers
    emit!(WithdrawFromLockupStream {
        deposited_token_mint: ctx.accounts.deposited_token_mint.key(),
        fee_in_lamports,
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft_mint: ctx.accounts.stream_nft_mint.key(),
        withdrawn_amount: amount,
    });

    Ok(())
}
