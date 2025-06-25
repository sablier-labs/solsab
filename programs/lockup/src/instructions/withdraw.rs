use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer},
};
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

const WITHDRAWAL_FEE: u64 = 10_000_000; // The fee for withdrawing from the stream, in lamports.

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(address = stream_data.deposited_token_mint)]
    pub deposited_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: This account must be the Stream's recipient (checked in recipient_stream_nft_ata's constraints)
    pub stream_recipient: UncheckedAccount<'info>,

    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [STREAM_DATA, stream_nft_mint.key().as_ref()],
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
        mut,
        associated_token::mint = stream_nft_mint,
        associated_token::authority = stream_recipient,
        associated_token::token_program = nft_token_program,
        // Dev: the below constraint is vital for making sure that the tokens are only withdrawn to the legit recipient
        constraint = recipient_stream_nft_ata.amount == 1,
        // TODO: are there any other ways in which one could "fake" the recipient's authority (and that need to be checked in this Ix)?
    )]
    pub recipient_stream_nft_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: This can be any address if the tx signer is the Stream's Recipient -
    /// and must be the Stream's Recipient if it's not
    #[account(
        constraint = (
            withdrawal_recipient.key() == stream_recipient.key() ||
            (withdrawal_recipient.key() != stream_recipient.key() &&
            signer.key() == stream_recipient.key())
        )
    )]
    pub withdrawal_recipient: UncheckedAccount<'info>,

    #[account(
      init_if_needed,
      payer = signer,
      associated_token::mint = deposited_token_mint,
      associated_token::authority = withdrawal_recipient,
      associated_token::token_program = deposited_token_program,
    )]
    pub withdrawal_recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      mut,
      seeds = [TREASURY],
      bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    pub system_program: Program<'info, System>,
    pub deposited_token_program: Interface<'info, TokenInterface>,
    pub nft_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Check: validate the withdraw.
    check_withdraw(
        ctx.accounts.stream_data.is_depleted,
        amount,
        get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts),
    )?;

    // Effect: update the stream data state.
    ctx.accounts.stream_data.withdraw(amount)?;

    // Interaction: transfer the fee from the signer to the treasury.
    let fee_collection_ix = transfer(&ctx.accounts.signer.key(), &ctx.accounts.treasury.key(), WITHDRAWAL_FEE);
    invoke(&fee_collection_ix, &[ctx.accounts.signer.to_account_info(), ctx.accounts.treasury.to_account_info()])?;

    // Interaction: transfer the tokens from the stream ATA to the recipient.
    transfer_tokens(
        ctx.accounts.stream_data_ata.to_account_info(),
        ctx.accounts.withdrawal_recipient_ata.to_account_info(),
        ctx.accounts.stream_data.to_account_info(),
        ctx.accounts.deposited_token_mint.to_account_info(),
        ctx.accounts.deposited_token_program.to_account_info(),
        amount,
        ctx.accounts.deposited_token_mint.decimals,
        &[&[STREAM_DATA, ctx.accounts.stream_nft_mint.key().as_ref(), &[ctx.accounts.stream_data.bump]]],
    )?;

    // Log the withdrawal.
    emit!(WithdrawFromLockupStream {
        deposited_token_mint: ctx.accounts.deposited_token_mint.key(),
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft_mint: ctx.accounts.stream_nft_mint.key(),
        withdrawn_amount: amount
    });

    Ok(())
}
