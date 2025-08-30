use anchor_lang::prelude::*;
use sablier_common::safe_collectable_amount;

use crate::{
    state::Treasury,
    utils::{constants::seeds::TREASURY, events, validations::check_collect_fees},
};

#[derive(Accounts)]
pub struct CollectFees<'info> {
    // -------------------------------------------------------------------------- //
    //                                USER ACCOUNTS                               //
    // -------------------------------------------------------------------------- //
    /// Write account: the account authorized to collect fees from the treasury.
    #[account(address = treasury.fee_collector)]
    pub fee_collector: Signer<'info>,

    /// Write account: the address that will receive the collected fees.
    /// CHECK: May be any account
    #[account(mut)]
    pub fee_recipient: UncheckedAccount<'info>,

    // -------------------------------------------------------------------------- //
    //                              SABLIER ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Write account: the treasury account that holds the fees.
    #[account(
      mut,
      seeds = [TREASURY],
      bump = treasury.bump,
    )]
    pub treasury: Box<Account<'info, Treasury>>,
}

/// See the documentation for [`fn@crate::sablier_merkle_instant::collect_fees`].
pub fn handler(ctx: Context<CollectFees>) -> Result<()> {
    // Calculate the amount collectable from the treasury in lamport units.
    let collectable_amount = safe_collectable_amount(&ctx.accounts.treasury.to_account_info())?;

    // Check: validate the collectable amount.
    check_collect_fees(collectable_amount)?;

    // Interaction: transfer the collect amount from the treasury to the fee recipient.
    ctx.accounts.treasury.sub_lamports(collectable_amount)?;
    ctx.accounts.fee_recipient.add_lamports(collectable_amount)?;

    // Log the fee collection.
    emit!(events::FeesCollected {
        fee_amount: collectable_amount,
        fee_collector: ctx.accounts.fee_collector.key(),
        fee_recipient: ctx.accounts.fee_recipient.key(),
    });

    Ok(())
}
