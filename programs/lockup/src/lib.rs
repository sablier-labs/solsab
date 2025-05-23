use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("Cmo3bW9vDNiESzNVgqUGzbmJZ68ncJkBMgLACaRRjXyY"); // Localnet & Devnet Program ID

#[program]
pub mod sablier_lockup {
    use super::*;

    pub fn cancel(ctx: Context<Cancel>, salt: u64) -> Result<()> {
        instructions::cancel::handler(ctx, salt)
    }

    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        instructions::collect_fees::handler(ctx)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_with_durations(
        ctx: Context<CreateWithTimestamps>,
        salt: u64,
        deposited_amount: u64,
        cliff_duration: i64,
        total_duration: i64,
        start_unlock: u64,
        cliff_unlock: u64,
        is_cancelable: bool,
    ) -> Result<()> {
        instructions::create_with_durations::handler(
            ctx,
            salt,
            deposited_amount,
            cliff_duration,
            total_duration,
            start_unlock,
            cliff_unlock,
            is_cancelable,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_with_timestamps(
        ctx: Context<CreateWithTimestamps>,
        salt: u64,
        deposited_amount: u64,
        start_time: i64,
        cliff_time: i64,
        end_time: i64,
        start_unlock: u64,
        cliff_unlock: u64,
        is_cancelable: bool,
    ) -> Result<()> {
        instructions::create_with_timestamps::handler(
            ctx,
            salt,
            deposited_amount,
            start_time,
            cliff_time,
            end_time,
            start_unlock,
            cliff_unlock,
            is_cancelable,
        )
    }

    pub fn initialize(ctx: Context<Initialize>, fee_collector: Pubkey) -> Result<()> {
        instructions::initialize::handler(ctx, fee_collector)
    }

    pub fn renounce(ctx: Context<Renounce>, salt: u64) -> Result<()> {
        instructions::renounce::handler(ctx, salt)
    }

    pub fn refundable_amount_of(ctx: Context<StreamView>, _salt: u64) -> Result<u64> {
        instructions::refundable_amount_of::handler(ctx)
    }

    pub fn status_of(ctx: Context<StreamView>, _salt: u64) -> Result<StreamStatus> {
        instructions::status_of::handler(ctx)
    }

    pub fn streamed_amount_of(ctx: Context<StreamView>, _salt: u64) -> Result<u64> {
        instructions::streamed_amount_of::handler(ctx)
    }

    pub fn withdraw(ctx: Context<Withdraw>, salt: u64, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, salt, amount)
    }

    pub fn withdrawable_amount_of(ctx: Context<StreamView>, _salt: u64) -> Result<u64> {
        instructions::withdrawable_amount_of::handler(ctx)
    }

    pub fn withdraw_max(ctx: Context<Withdraw>, salt: u64) -> Result<()> {
        instructions::withdraw_max::handler(ctx, salt)
    }
}
