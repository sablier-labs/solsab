use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("9she3vL2CCmWjPBFVVXwu78kYg7TU8jm69siH3STngXx"); // Localnet & Devnet Program ID

#[program]
pub mod sablier_merkle_instant {
    use super::*;

    pub fn campaign_view(ctx: Context<CampaignView>) -> Result<state::campaign::Campaign> {
        instructions::campaign_view::handler(ctx)
    }

    pub fn claim(ctx: Context<Claim>, index: u32, amount: u64, merkle_proof: Vec<[u8; 32]>) -> Result<()> {
        instructions::claim::handler(ctx, index, amount, merkle_proof)
    }

    pub fn clawback(ctx: Context<Clawback>, amount: u64) -> Result<()> {
        instructions::clawback::handler(ctx, amount)
    }

    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        instructions::collect_fees::handler(ctx)
    }

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        merkle_root: [u8; 32],
        expiration_time: i64,
        ipfs_id: String,
        name: String,
        aggregate_amount: u64,
        recipient_count: u32,
    ) -> Result<()> {
        instructions::create_campaign::handler(
            ctx,
            merkle_root,
            expiration_time,
            name,
            ipfs_id,
            aggregate_amount,
            recipient_count,
        )
    }

    pub fn has_claimed(ctx: Context<HasClaimed>, _index: u32) -> Result<bool> {
        Ok(ctx.accounts.claim_status.is_some())
    }

    pub fn has_expired(ctx: Context<CampaignView>) -> Result<bool> {
        instructions::has_expired::handler(ctx)
    }

    pub fn has_grace_period_passed(ctx: Context<CampaignView>) -> Result<bool> {
        instructions::has_grace_period_passed::handler(ctx)
    }

    pub fn initialize(ctx: Context<Initialize>, fee_collector: Pubkey) -> Result<()> {
        instructions::initialize::handler(ctx, fee_collector)
    }
}
