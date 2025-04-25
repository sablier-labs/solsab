use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("CCbf8DjzYCUgSTRGDiTiff6LkeMgt9q1XkbLMByMFtgc"); // Localnet & Devnet Program ID

#[program]
pub mod sablier_lockup {
    use super::*;

    pub fn cancel(ctx: Context<Cancel>, _stream_id: u64) -> Result<()> {
        instructions::cancel::handler(ctx)
    }

    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        instructions::collect_fees::handler(ctx)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_with_durations(
        ctx: Context<CreateWithTimestamps>,
        cliff_duration: i64,
        total_duration: i64,
        deposited_amount: u64,
        start_unlock: u64,
        cliff_unlock: u64,
        is_cancelable: bool,
    ) -> Result<()> {
        instructions::create_with_durations::handler(
            ctx,
            cliff_duration,
            total_duration,
            deposited_amount,
            start_unlock,
            cliff_unlock,
            is_cancelable,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_with_timestamps(
        ctx: Context<CreateWithTimestamps>,
        start_time: i64,
        start_unlock: u64,
        cliff_time: i64,
        cliff_unlock: u64,
        end_time: i64,
        deposited_amount: u64,
        is_cancelable: bool,
    ) -> Result<()> {
        instructions::create_with_timestamps::handler(
            ctx,
            start_time,
            start_unlock,
            cliff_time,
            cliff_unlock,
            end_time,
            deposited_amount,
            is_cancelable,
        )
    }

    pub fn initialize_phase_one(ctx: Context<InitializePhaseOne>, fee_collector: Pubkey) -> Result<()> {
        instructions::initialize_phase_one::handler(ctx, fee_collector)
    }

    pub fn initialize_phase_two(ctx: Context<InitializePhaseTwo>) -> Result<()> {
        instructions::initialize_phase_two::handler(ctx)
    }

    pub fn prepare_for_stream_creation(ctx: Context<PrepareForStreamCreation>) -> Result<()> {
        instructions::prepare_for_stream_creation::handler(ctx)
    }

    pub fn renounce(ctx: Context<Renounce>, _stream_id: u64) -> Result<()> {
        instructions::renounce::handler(ctx)
    }

    pub fn withdraw(ctx: Context<Withdraw>, _stream_id: u64, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }

    pub fn withdrawable_amount_of(ctx: Context<WithdrawableAmountOf>, stream_id: u64) -> Result<u64> {
        instructions::withdrawable_amount_of::handler(ctx, stream_id)
    }

    pub fn withdraw_max(ctx: Context<Withdraw>, _stream_id: u64) -> Result<()> {
        instructions::withdraw_max::handler(ctx)
    }
}
