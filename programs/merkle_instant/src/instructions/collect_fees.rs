use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;

use crate::{
    state::Treasury,
    utils::{constants::seeds::TREASURY_SEED, events, validations::check_collect_fees},
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
      bump = treasury.bump,
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

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
        fee_collector: ctx.accounts.fee_collector.key(),
        fee_recipient: ctx.accounts.fee_recipient.key(),
        fee_amount: collectable_amount
    });

    Ok(())
}

// TODO: abstract this to a utils module used by both Lockup and Merkle Instant
/// Helper function to calculate the collectable amount from an account. It takes an extra-safe approach by adding a
/// buffer to the rent exemption, ensuring that the account balance does not fall below the rent-exempt minimum, which
/// could otherwise make the program unusable.
pub fn safe_collectable_amount(account: &AccountInfo) -> Result<u64> {
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
