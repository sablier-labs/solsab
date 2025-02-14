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

    pub fn cancel(ctx: Context<Cancel>, stream_id: u64) -> Result<()> {
        instructions::cancel::handler(ctx, stream_id)
    }

    pub fn create_with_timestamps(
        ctx: Context<CreateWithTimestamps>,
        start_time: i64,
        cliff_time: i64,
        end_time: i64,
        deposited_amount: u64,
        is_cancelable: bool,
    ) -> Result<()> {
        instructions::create_with_timestamps::handler(
            ctx,
            start_time,
            cliff_time,
            end_time,
            deposited_amount,
            is_cancelable,
        )
    }

    pub fn initialize_phase_one(ctx: Context<InitializePhaseOne>) -> Result<()> {
        instructions::initialize_phase_one::handler(ctx)
    }

    pub fn initialize_phase_two(ctx: Context<InitializePhaseTwo>) -> Result<()> {
        instructions::initialize_phase_two::handler(ctx)
    }

    pub fn prepare_for_stream_creation(ctx: Context<PrepareForStreamCreation>) -> Result<()> {
        instructions::prepare_for_stream_creation::handler(ctx)
    }

    pub fn renounce(ctx: Context<Renounce>, stream_id: u64) -> Result<()> {
        instructions::renounce::handler(ctx, stream_id)
    }

    pub fn withdraw(ctx: Context<Withdraw>, stream_id: u64, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, stream_id, amount)
    }

    pub fn withdraw_max(ctx: Context<Withdraw>, stream_id: u64) -> Result<()> {
        instructions::withdraw_max::handler(ctx, stream_id)
    }
}
