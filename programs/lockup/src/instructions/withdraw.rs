use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use mpl_core::accounts::BaseAssetV1;

use crate::{
    state::{lockup::StreamData, treasury::Treasury},
    utils::{
        constants::{seeds::*, WITHDRAWAL_FEE_USD},
        events::WithdrawFromLockupStream,
        fee_calculation::convert_usd_fee_to_lamports,
        transfer_helper::transfer_tokens,
        validations::check_withdraw,
    },
};

// -------------------------------------------------------------------------- //
//                                IX ACCOUNTS                                 //
// -------------------------------------------------------------------------- //

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // -------------------------------------------------------------------------- //
    //                               USER ACCOUNTS                                //
    // -------------------------------------------------------------------------- //
    /// Write account: the signer of the withdrawal who pays the withdrawal fee.
    #[account(mut)]
    pub signer: Signer<'info>,

    /// Read account: the account that will receive the withdrawn tokens.
    #[account(
      constraint = (
        withdrawal_recipient.key() == stream_nft.owner ||
        signer.key() == stream_nft.owner
      )
    )]
    /// CHECK: Must be the stream recipient - or, if the signer is the stream recipient, it can be any address.
    pub withdrawal_recipient: UncheckedAccount<'info>,

    /// Create-if-needed account: the withdrawal recipient's ATA for the deposited tokens.
    #[account(
      init_if_needed,
      payer = signer,
      associated_token::authority = withdrawal_recipient,
      associated_token::mint = deposited_token_mint,
      associated_token::token_program = deposited_token_program,
    )]
    pub withdrawal_recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // -------------------------------------------------------------------------- //
    //                              SABLIER ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Write account: the treasury account that receives the withdrawal fee.
    #[account(
      mut,
      seeds = [TREASURY],
      bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    // -------------------------------------------------------------------------- //
    //                               STREAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the mint account for the deposited token.
    #[account(address = stream_data.deposited_token_mint)]
    pub deposited_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Write account: the account storing the stream data.
    #[account(
      mut,
      seeds = [STREAM_DATA, stream_nft.key().as_ref()],
      bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    /// Write account: the ATA for deposited tokens owned by stream data.
    #[account(
      mut,
      associated_token::authority = stream_data,
      associated_token::mint = deposited_token_mint,
      associated_token::token_program = deposited_token_program,
    )]
    pub stream_data_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Read account: the NFT representing the stream.
    #[account(address = stream_data.nft_address)]
    pub stream_nft: Box<Account<'info, BaseAssetV1>>,

    // -------------------------------------------------------------------------- //
    //                               PROGRAM ACCOUNTS                             //
    // -------------------------------------------------------------------------- //
    /// Program account: the Associated Token program.
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Read account: The Chainlink program used to retrieve on-chain price feeds.
    /// CHECK: This is the Chainlink program.
    #[account(address = treasury.chainlink_program)]
    pub chainlink_program: AccountInfo<'info>,

    /// Read account: The account providing the SOL/USD price feed data.
    /// CHECK: We're reading data from this Chainlink feed.
    #[account(address = treasury.chainlink_sol_usd_feed)]
    pub chainlink_sol_usd_feed: AccountInfo<'info>,

    /// Program account: the Token program of the deposited token.
    pub deposited_token_program: Interface<'info, TokenInterface>,

    // -------------------------------------------------------------------------- //
    //                               SYSTEM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the System program.
    pub system_program: Program<'info, System>,
}

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_lockup::withdraw`].
pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Check: validate the withdrawal.
    check_withdraw(&ctx.accounts.stream_data, amount)?;

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
        &[&[STREAM_DATA, ctx.accounts.stream_nft.key().as_ref(), &[ctx.accounts.stream_data.bump]]],
    )?;

    // Log the withdrawal.
    emit!(WithdrawFromLockupStream {
        deposited_token_mint: ctx.accounts.deposited_token_mint.key(),
        fee_in_lamports,
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft: ctx.accounts.stream_nft.key(),
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
        convert_usd_fee_to_lamports(WITHDRAWAL_FEE_USD, chainlink_program, chainlink_sol_usd_feed);

    if fee_in_lamports > 0 {
        // Interaction: transfer the fee from the signer to the treasury.
        let fee_charging_ix = transfer(&tx_signer.key(), &treasury.key(), fee_in_lamports);
        invoke(&fee_charging_ix, &[tx_signer, treasury])?;
    }

    Ok(fee_in_lamports)
}
