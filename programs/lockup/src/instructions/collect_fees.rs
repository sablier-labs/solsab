use anchor_lang::prelude::*;

use crate::{
    state::treasury::Treasury,
    utils::{constants::seeds::TREASURY, events::FeesCollected, validations::check_collect_fees},
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
    #[account(mut)]
    /// CHECK: May be any account
    pub fee_recipient: UncheckedAccount<'info>,

    // -------------------------------------------------------------------------- //
    //                              SABLIER ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Write account: the treasury account that holds the fees.
    #[account(
      mut,
      seeds = [TREASURY],
      bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,
}

/// See the documentation for [`fn@crate::sablier_lockup::collect_fees`].
pub fn handler(ctx: Context<CollectFees>) -> Result<()> {
    // Calculate the amount collectable from the treasury in lamport units.
    let collectible_amount = safe_collectible_amount(&ctx.accounts.treasury.to_account_info())?;

    // Check: validate the collectable amount.
    check_collect_fees(collectible_amount)?;

    // Interaction: transfer the collect amount from the treasury to the fee recipient.
    ctx.accounts.treasury.sub_lamports(collectible_amount)?;
    ctx.accounts.fee_recipient.add_lamports(collectible_amount)?;

    // Log the fee collection.
    emit!(FeesCollected {
        fee_amount: collectible_amount,
        fee_collector: ctx.accounts.fee_collector.key(),
        fee_recipient: ctx.accounts.fee_recipient.key()
    });

    Ok(())
}

/// Helper function to calculate the collectable amount from an account. As a precaution, we add a buffer to the rent
/// exemption, ensuring that the account balance will not fall below the rent-exempt minimum. This could otherwise
/// make the program unusable.
pub fn safe_collectible_amount(account: &AccountInfo) -> Result<u64> {
    // Retrieve the current balance of the account.
    let current_balance = account.lamports();

    // Determine the size of the account's data.
    let data_len = account.data_len();

    // Retrieve the rent sysvar.
    let rent = Rent::get()?;

    // Calculate the minimum balance needed for rent exemption.
    let rent_exempt_minimum = rent.minimum_balance(data_len);

    let buffer = 1_000_000; // 0.001 SOL
    let safe_minimum = rent_exempt_minimum.checked_add(buffer).unwrap();

    // Return the collectable amount
    Ok(current_balance.saturating_sub(safe_minimum))
}
