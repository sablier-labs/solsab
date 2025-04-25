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
    pub recipient: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,
}

pub fn handler(ctx: Context<CollectFees>, lamports_amount: u64) -> Result<()> {
    check_collect_fees(lamports_amount, withdrawable_lamports(&ctx.accounts.treasury.to_account_info())?)?;

    // Interaction: transfer the collect amount from the treasury to the fee recipient.
    ctx.accounts.treasury.sub_lamports(lamports_amount)?;
    ctx.accounts.recipient.add_lamports(lamports_amount)?;

    // Log the fee withdrawal.
    emit!(FeesCollected {
        fee_collector: ctx.accounts.fee_collector.key(),
        fee_recipient: ctx.accounts.recipient.key(),
        lamports_amount
    });

    Ok(())
}

pub fn withdrawable_lamports(account: &AccountInfo) -> Result<u64> {
    // Get the current balance of the account
    let current_balance = account.lamports();

    // Get the safe rent exempt minimum
    let safe_rent_exempt_minimum = safe_rent_exempt_minimum(account)?;

    // Return the withdrawable amount
    Ok(current_balance.saturating_sub(safe_rent_exempt_minimum))
}

pub fn safe_rent_exempt_minimum(account: &AccountInfo) -> Result<u64> {
    // Determine the size of the account’s data.
    let data_len = account.data_len();

    // Retrieve the rent sysvar.
    let rent = Rent::get()?;

    // Calculate the minimum balance needed for rent exemption.
    let rent_exempt_minimum = rent.minimum_balance(data_len);

    // To be extra safe, double the rent exempt minimum
    //
    // Note: this step is critical, because if the account balance goes below the rent exempt minimum, it may get
    // deleted by the runtime (effectively making the whole program unusable)!
    let safe_rent_exempt_minimum = rent_exempt_minimum.checked_mul(2).unwrap();

    Ok(safe_rent_exempt_minimum)
}
