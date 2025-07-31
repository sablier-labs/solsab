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
        constants::{seeds::*, WITHDRAWAL_FEE_USD},
        events::WithdrawFromLockupStream,
        fee_calculation::convert_usd_to_fee_in_lamports,
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

    /// Read account: The Chainlink program used to retrieve on-chain price feeds.
    /// CHECK: This is the Chainlink program.
    #[account(address = treasury.chainlink_program)]
    pub chainlink_program: AccountInfo<'info>,

    /// Read account: The account providing the SOL/USD price feed data.
    /// CHECK: We're reading data from this Chainlink feed.
    #[account(address = treasury.chainlink_sol_usd_feed)]
    pub chainlink_sol_usd_feed: AccountInfo<'info>,

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
    let fee_in_lamports = charge_withdrawal_fee(
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
        fee_in_lamports,
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft_mint: ctx.accounts.stream_nft_mint.key(),
        withdrawn_amount: amount,
    });

    Ok(())
}

/// Charges the withdrawal fee in lamports.
fn charge_withdrawal_fee<'info>(
    chainlink_program: AccountInfo<'info>,
    chainlink_sol_usd_feed: AccountInfo<'info>,
    tx_signer: AccountInfo<'info>,
    treasury: AccountInfo<'info>,
) -> Result<u64> {
    // Calculate the fee in lamports.
    let fee_in_lamports: u64 =
        convert_usd_to_fee_in_lamports(WITHDRAWAL_FEE_USD, chainlink_program, chainlink_sol_usd_feed);

    // Interaction: transfer the fee from the signer to the treasury.
    let fee_charging_ix = transfer(&tx_signer.key(), &treasury.key(), fee_in_lamports);
    invoke(&fee_charging_ix, &[tx_signer, treasury])?;

    Ok(fee_in_lamports)
}
