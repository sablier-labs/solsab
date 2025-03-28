use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("D66QHFxwZynfc2NfxTogm8M62T6SUBcuASPcxqMoTjgF"); // Localnet Program ID

// declare_id!("uwuJk35aCL3z2FzfPr8fQE1U19A8N18qdA5YfdfUbPt"); // Devnet Program ID

#[program]
pub mod sablier_lockup {
    use super::*;

    pub fn cancel(ctx: Context<Cancel>, _stream_id: u64) -> Result<()> {
        instructions::cancel::handler(ctx)
    }

    pub fn collect_fees(ctx: Context<CollectFees>, lamports_amount: u64) -> Result<()> {
        instructions::collect_fees::handler(ctx, lamports_amount)
    }

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
        instructions::stream_creation::create_with_timestamps::handler(
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

    pub fn withdraw_max(ctx: Context<Withdraw>, _stream_id: u64) -> Result<()> {
        instructions::withdraw_max::handler(ctx)
    }
}
