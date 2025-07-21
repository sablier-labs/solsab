use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer, sysvar::clock::Clock},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use chainlink_solana as chainlink;

use crate::{
    state::{lockup::StreamData, treasury::Treasury},
    utils::{
        constants::{misc::*, seeds::*},
        events::WithdrawFromLockupStream,
        lockup_math::get_withdrawable_amount,
        transfer_helper::transfer_tokens,
        validations::check_withdraw,
    },
};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// Write account: the signer of the withdrawal who pays the withdrawal fee.
    #[account(mut)]
    pub signer: Signer<'info>,

    /// Read account: the mint account for the deposited token.
    #[account(address = stream_data.deposited_token_mint)]
    pub deposited_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Read account: the recipient of the stream who owns the stream NFT.
    /// CHECK: This account must be the Stream's recipient (checked in recipient_stream_nft_ata's constraints)
    pub stream_recipient: UncheckedAccount<'info>,

    /// Read account: the mint account for the stream NFT.
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Write account: the account storing the stream data.
    #[account(
        mut,
        seeds = [STREAM_DATA, stream_nft_mint.key().as_ref()],
        bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    /// Write account: the ATA for deposited tokens owned by stream data.
    #[account(
        mut,
        associated_token::mint = deposited_token_mint,
        associated_token::authority = stream_data,
        associated_token::token_program = deposited_token_program,
    )]
    pub stream_data_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Read account: the ATA for the stream NFT owned by recipient.
    #[account(
        associated_token::mint = stream_nft_mint,
        associated_token::authority = stream_recipient,
        associated_token::token_program = nft_token_program,
        // Dev: the below constraint is vital for making sure that the tokens are only withdrawn to the legit recipient
        constraint = recipient_stream_nft_ata.amount == 1,
        // TODO: are there any other ways in which one could "fake" the recipient's authority (and that need to be checked in this Ix)?
    )]
    pub recipient_stream_nft_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Read account: the account that will receive the withdrawn tokens.
    #[account(
        constraint = (
            withdrawal_recipient.key() == stream_recipient.key() ||
            (withdrawal_recipient.key() != stream_recipient.key() &&
            signer.key() == stream_recipient.key())
        )
    )]
    /// CHECK: This can be any address if the signer is the stream's recipient, otherwise it must be the stream's
    /// recipient.
    pub withdrawal_recipient: UncheckedAccount<'info>,

    /// Create if needed account: the ATA for deposited tokens owned by withdrawal recipient.
    #[account(
      init_if_needed,
      payer = signer,
      associated_token::mint = deposited_token_mint,
      associated_token::authority = withdrawal_recipient,
      associated_token::token_program = deposited_token_program,
    )]
    pub withdrawal_recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Write account: the treasury account that receives the withdrawal fee
    #[account(
      mut,
      seeds = [TREASURY],
      bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    /// CHECK: We're reading data from this chainlink feed
    pub chainlink_sol_usd_feed: AccountInfo<'info>,

    /// CHECK: This is the Chainlink program library
    pub chainlink_program: AccountInfo<'info>,

    /// Program account: the System program.
    pub system_program: Program<'info, System>,

    /// Program account: the Token program of the deposited token.
    pub deposited_token_program: Interface<'info, TokenInterface>,

    /// Program account: the Token program of the stream NFT.
    pub nft_token_program: Interface<'info, TokenInterface>,

    /// Program account: the Associated Token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
}

/// See the documentation of the {lib.rs#withdraw} function.
pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Check: validate the withdraw.
    check_withdraw(
        ctx.accounts.stream_data.is_depleted,
        amount,
        get_withdrawable_amount(&ctx.accounts.stream_data.timestamps, &ctx.accounts.stream_data.amounts),
    )?;

    // Effect: update the stream data state.
    ctx.accounts.stream_data.withdraw(amount)?;

    // Interaction: charge the withdrawal fee.
    charge_withdrawal_fee(
        ctx.accounts.chainlink_program.to_account_info(),
        ctx.accounts.chainlink_sol_usd_feed.to_account_info(),
        ctx.accounts.signer.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
    )?;

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

// TODO: export this into a crate that'd be imported by both the lockup and merkle_instant programs.
fn charge_withdrawal_fee<'info>(
    chainlink_program: AccountInfo<'info>,
    chainlink_sol_usd_feed: AccountInfo<'info>,
    tx_signer: AccountInfo<'info>,
    treasury: AccountInfo<'info>,
) -> Result<()> {
    let round = chainlink::latest_round_data(chainlink_program.clone(), chainlink_sol_usd_feed.clone())?;

    let round_timestamp: i64 = round.timestamp as i64;
    let current_timestamp: i64 = Clock::get()?.unix_timestamp;
    const SECONDS_IN_24_HOURS: i64 = 86400;
    let timestamp_24h_ago = current_timestamp - SECONDS_IN_24_HOURS;

    // Check: only charge the fee if the round data is valid (i.e. its timestamp is strictly within the last 24 hours).
    // Otherwise, skip the fee charging.
    if
    /* current_timestamp > round_timestamp && */
    round_timestamp > timestamp_24h_ago {
        let decimals = chainlink::decimals(chainlink_program.clone(), chainlink_sol_usd_feed.clone())?;

        // Calculate the SOL price in USD as an integer value, truncating the sub-dollar amount.
        let sol_price_usd = (round.answer / 10_i128.pow(decimals as u32)) as u64;

        // Transform the fee from USD to Lamports.
        let fee_in_lamports = (WITHDRAWAL_FEE_USD * NO_LAMPORTS_IN_1_SOL) / sol_price_usd;

        // Interaction: transfer the fee from the signer to the treasury.
        let fee_charging_ix = transfer(&tx_signer.key(), &treasury.key(), fee_in_lamports);
        invoke(&fee_charging_ix, &[tx_signer, treasury])?;
    }
    Ok(())
}
