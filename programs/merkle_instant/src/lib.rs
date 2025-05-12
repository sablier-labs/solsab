use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("9she3vL2CCmWjPBFVVXwu78kYg7TU8jm69siH3STngXx"); // Localnet & Devnet Program ID

#[program]
pub mod sablier_merkle_instant {
    use super::*;

    pub fn campaign_name(ctx: Context<CampaignView>, merkle_root: [u8; 32]) -> Result<String> {
        instructions::campaign_name::handler(ctx, merkle_root)
    }

    pub fn claim(
        ctx: Context<Claim>,
        merkle_root: [u8; 32],
        leaf_id: u32,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::claim::handler(ctx, merkle_root, leaf_id, amount, proof)
    }

    pub fn clawback(ctx: Context<Clawback>, _merkle_root: [u8; 32], amount: u64) -> Result<()> {
        instructions::clawback::handler(ctx, _merkle_root, amount)
    }

    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        instructions::collect_fees::handler(ctx)
    }

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        name: String,
        recipient_count: u32,
        expiration_time: i64,
        merkle_tree_ipfs_id: String,
        merkle_root: [u8; 32],
    ) -> Result<()> {
        instructions::create_campaign::handler(
            ctx,
            name,
            recipient_count,
            merkle_tree_ipfs_id,
            merkle_root,
            expiration_time,
        )
    }

    pub fn has_claimed(ctx: Context<HasClaimed>, merkle_root: [u8; 32], leaf_id: u32) -> Result<bool> {
        instructions::has_claimed::handler(ctx, merkle_root, leaf_id)
    }

    pub fn has_expired(ctx: Context<CampaignView>, merkle_root: [u8; 32]) -> Result<bool> {
        instructions::has_expired::handler(ctx, merkle_root)
    }

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }
}
