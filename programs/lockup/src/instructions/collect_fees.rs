use anchor_lang::prelude::*;

use crate::{
    state::treasury::Treasury,
    utils::{constants::*, events::FeesCollected, validations::check_collect_fees},
};

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(
        mut,
        address = treasury.fee_collector,
    )]
    pub fee_collector: Signer<'info>,

    #[account(mut)]
    /// CHECK: May be any account
    pub fee_recipient: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,
}

pub fn handler(ctx: Context<CollectFees>) -> Result<()> {
    // Calculate the amount collectable from the treasury in lamport units.
    let collectable_amount = collectable_amount(&ctx.accounts.treasury.to_account_info())?;

    // Check: validate the collectable amount.
    check_collect_fees(collectable_amount)?;

    // Interaction: transfer the collect amount from the treasury to the fee recipient.
    ctx.accounts.treasury.sub_lamports(collectable_amount)?;
    ctx.accounts.fee_recipient.add_lamports(collectable_amount)?;

    // Log the fee withdrawal.
    emit!(FeesCollected {
        fee_collector: ctx.accounts.fee_collector.key(),
        fee_recipient: ctx.accounts.fee_recipient.key(),
        fee_amount: collectable_amount
    });

    Ok(())
}

/// Helper function to calculate the collectable amount from an account. It takes an extra-safe approach by doubling
/// the rent exemption, ensuring that the account balance does not fall below the rent-exempt minimum, which
/// could otherwise make the program unusable.
pub fn collectable_amount(account: &AccountInfo) -> Result<u64> {
    // Retrieve the current balance of the account.
    let current_balance = account.lamports();

    // Determine the size of the account’s data.
    let data_len = account.data_len();

    // Retrieve the rent sysvar.
    let rent = Rent::get()?;

    // Calculate the minimum balance needed for rent exemption.
    let rent_exempt_minimum = rent.minimum_balance(data_len);

    // Double the minimum to ensure the account stays rent-exempt.
    let safe_rent_exempt_minimum = rent_exempt_minimum.checked_mul(2).unwrap();

    // Return the collectable amount
    Ok(current_balance.saturating_sub(safe_rent_exempt_minimum))
}
