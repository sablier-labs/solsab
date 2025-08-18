#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

// Program ID for the Sablier Merkle Instant program, used for both localnet and devnet deployments.
declare_id!("GrZhWdwBgZakydbyUMx1eTkCT5Eei7LC21i87Ag7Vh1D");

/// Sablier Merkle Instant program for creating and managing Merkle tree-based airdrop campaigns.
#[program]
pub mod sablier_merkle_instant {
    use super::*;

    // -------------------------------------------------------------------------- //
    //                         STATE-CHANGING INSTRUCTIONS                        //
    // -------------------------------------------------------------------------- //

    /// Claims airdrop on behalf of eligible recipient and transfers it to the recipient ATA.
    ///
    /// # Accounts Expected
    ///
    /// - `claimer` The transaction signer.
    /// - `campaign` The account that stores the campaign details.
    /// - `recipient` The address of the airdrop recipient.
    /// - `airdrop_token_mint` The mint of the airdropped token.
    /// - `airdrop_token_program` The Token Program of the airdropped token.
    /// - `chainlink_program`: The Chainlink program used to retrieve on-chain price feeds.
    /// - `chainlink_sol_usd_feed`: The account providing the SOL/USD price feed data.
    ///
    /// # Parameters
    ///
    /// - `index` The index of the recipient in the Merkle tree.
    /// - `amount` The amount allocated to the recipient.
    /// - `merkle_proof` The proof of inclusion in the Merkle tree.
    ///
    /// # Notes
    ///
    /// - The instruction charges a fee in the native token (SOL), equivalent to $2 USD.
    /// - Emits a [`crate::utils::events::Claim`] event.
    ///
    /// # Requirements
    ///
    /// - The current time must be greater than or equal to the campaign start time.
    ///
    /// - The campaign must not have expired.
    /// - The recipient's airdrop has not been claimed yet.
    /// - The Merkle proof must be valid.
    /// - `chainlink_program` and `chainlink_sol_usd_feed` must match the ones stored in the treasury.
    pub fn claim(ctx: Context<Claim>, index: u32, amount: u64, merkle_proof: Vec<[u8; 32]>) -> Result<()> {
        instructions::claim::handler(ctx, index, amount, merkle_proof)
    }

    /// Claws back the unclaimed tokens from the campaign.
    ///
    /// # Accounts Expected
    ///
    /// - `campaign` The account that stores the campaign details.
    /// - `campaign_creator` The transaction signer.
    /// - `airdrop_token_mint` The mint of the airdropped token.
    /// - `airdrop_token_program` The Token Program of the airdropped token.
    ///
    /// # Parameters
    ///
    /// - `amount` The amount to claw back.
    ///
    /// # Notes
    ///
    /// - Emits a [`crate::utils::events::Clawback`] event.
    ///
    /// # Requirements
    ///
    /// - The signer must be the actual campaign creator.
    /// - No claim must be made, OR the current timestamp must not exceed 7 days after the first claim, OR the campaign
    /// must be expired.
    pub fn clawback(ctx: Context<Clawback>, amount: u64) -> Result<()> {
        instructions::clawback::handler(ctx, amount)
    }

    /// Collects the fees accumulated in the treasury by transferring them to the fee recipient.
    ///
    /// # Accounts Expected
    ///
    /// - `fee_collector` The transaction signer and the fee collector.
    /// - `fee_recipient` The address receiving the collected fees.
    ///
    /// # Notes
    ///
    /// - To calculate the "collectable amount", the rent-exempt minimum balance and a 0.001 SOL buffer are deducted
    /// from the treasury SOL balance.
    /// - Emits a [`crate::utils::events::FeesCollected`] event.
    ///
    /// # Requirements
    ///
    /// - `fee_collector` must be authorized for fee collection.
    /// - The "collectable amount" must be greater than zero.
    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        instructions::collect_fees::handler(ctx)
    }

    /// Creates a Merkle Instant airdrop campaign.
    ///
    /// # Accounts Expected
    ///
    /// - `creator` The transaction signer and the campaign creator.
    /// - `airdrop_token_mint` The mint of the airdropped token.
    /// - `airdrop_token_program` The Token Program of the airdropped token.
    ///
    /// # Parameters
    ///
    /// - `merkle_root` The Merkle root of the claim data.
    /// - `campaign_start_time` The time when the campaign starts, in seconds since the Unix epoch.
    /// - `expiration_time` The time when the campaign expires, in seconds since the Unix epoch.
    /// A value of zero means the campaign does not expire.
    /// - `name` The name of the campaign.
    /// - `ipfs_cid` The content identifier for indexing the campaign on IPFS. An empty value may break some UI
    /// features that depend upon the IPFS CID.
    /// - `aggregate_amount` The total amount of tokens to be distributed to all recipients.
    /// - `recipient_count` The total number of recipient addresses eligible for the airdrop.
    ///
    /// # Notes
    ///
    /// - Emits a [`crate::utils::events::CreateCampaign`] event.
    #[allow(clippy::too_many_arguments)]
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        merkle_root: [u8; 32],
        campaign_start_time: i64,
        expiration_time: i64,
        name: String,
        ipfs_cid: String,
        aggregate_amount: u64,
        recipient_count: u32,
    ) -> Result<()> {
        instructions::create_campaign::handler(
            ctx,
            merkle_root,
            campaign_start_time,
            expiration_time,
            name,
            ipfs_cid,
            aggregate_amount,
            recipient_count,
        )
    }

    /// Initializes the program with the provided fee collector address.
    ///
    /// # Accounts Expected
    ///
    /// - `initializer` The transaction signer.
    ///
    /// # Parameters
    ///
    /// - `fee_collector` The address that will have the authority to collect fees.
    /// - `chainlink_program`: The Chainlink program used to retrieve on-chain price feeds.
    /// - `chainlink_sol_usd_feed`: The account providing the SOL/USD price feed data.
    pub fn initialize(
        ctx: Context<Initialize>,
        fee_collector: Pubkey,
        chainlink_program: Pubkey,
        chainlink_sol_usd_feed: Pubkey,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, fee_collector, chainlink_program, chainlink_sol_usd_feed)
    }

    // -------------------------------------------------------------------------- //
    //                           READ-ONLY INSTRUCTIONS                           //
    // -------------------------------------------------------------------------- //

    /// Retrieves the campaign details.
    ///
    /// # Accounts Expected
    ///
    /// - `campaign` The account that stores the campaign details.
    pub fn campaign_view(ctx: Context<CampaignView>) -> Result<state::Campaign> {
        instructions::campaign_view::handler(ctx)
    }

    /// Calculates the claim fee in lamports, which is equivalent to $2 USD.
    ///
    /// # Accounts Expected:
    ///
    /// - `chainlink_program`: The Chainlink program used to retrieve on-chain price feeds.
    /// - `chainlink_sol_usd_feed`: The account providing the SOL/USD price feed data.
    pub fn claim_fee_in_lamports(ctx: Context<ClaimFeeInLamports>) -> Result<u64> {
        instructions::claim_fee_in_lamports::handler(ctx)
    }

    /// Returns a flag indicating whether a claim has been made for the given index.
    ///
    /// # Accounts Expected
    ///
    /// - `campaign` The account that stores the campaign details.
    ///
    /// # Parameters
    ///
    /// - `index` The index of the recipient in the Merkle tree.
    pub fn has_claimed(ctx: Context<HasClaimed>, _index: u32) -> Result<bool> {
        Ok(!ctx.accounts.claim_receipt.data_is_empty())
    }

    /// Returns a flag indicating whether the campaign has expired.
    ///
    /// # Accounts Expected
    ///
    /// - `campaign` The account that stores the campaign details.
    pub fn has_expired(ctx: Context<CampaignView>) -> Result<bool> {
        instructions::has_expired::handler(ctx)
    }

    /// Returns a flag indicating whether the grace period of the campaign has passed.
    ///
    /// # Accounts Expected
    ///
    /// - `campaign` The account that stores the campaign details.
    ///
    /// # Notes
    ///
    /// - A return value of `false` indicates: No claim has been made yet, OR the current timestamp does not exceed
    /// seven days after the first claim.
    pub fn has_grace_period_passed(ctx: Context<CampaignView>) -> Result<bool> {
        instructions::has_grace_period_passed::handler(ctx)
    }

    /// Returns a flag indicating whether the campaign has started.
    ///
    /// # Accounts expected:
    ///
    /// - `campaign` The account that stores the campaign details.
    pub fn has_campaign_started(ctx: Context<CampaignView>) -> Result<bool> {
        instructions::has_campaign_started::handler(ctx)
    }
}
