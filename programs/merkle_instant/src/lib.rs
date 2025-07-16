use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("GthZ6aQHJonsia3jpdrSBukxipyRfo9TR5ZrepGXLTQR"); // Localnet & Devnet Program ID

#[program]
pub mod sablier_merkle_instant {
    use super::*;

    ////////////////////////////////////////////////////////////////////////////
    //                          STATE-CHANGING IXs                            //
    ////////////////////////////////////////////////////////////////////////////

    /// Claim airdrop on behalf of eligible recipient and transfer it to the recipient ATA.
    ///
    /// Notes:
    /// - Emits a {Claim} event.
    ///
    /// Accounts expected:
    /// - `claimer` The transaction signer.
    /// - `campaign` The account that stores the campaign details.
    /// - `recipient` The address of the airdrop recipient.
    /// - `airdrop_token_mint` The mint of the airdropped token.
    /// - `airdrop_token_program` The Token Program of the airdropped token.
    ///
    /// Parameters:
    /// - `index` The index of the recipient in the Merkle tree.
    /// - `amount` The amount allocated to the recipient.
    /// - `merkle_proof` The proof of inclusion in the Merkle tree.
    ///
    /// Requirements:
    /// - The current time must be greater than or equal to the campaign start time.
    /// - The campaign must not have expired.
    /// - The `index` must not be claimed already.
    /// - The Merkle proof must be valid.
    pub fn claim(ctx: Context<Claim>, index: u32, amount: u64, merkle_proof: Vec<[u8; 32]>) -> Result<()> {
        instructions::claim::handler(ctx, index, amount, merkle_proof)
    }

    /// Claws back the unclaimed tokens.
    ///
    /// Notes:
    /// - Emits a {Clawback} event.
    ///
    /// Accounts expected:
    /// - `campaign` The account that stores the campaign details.
    /// - `campaign_creator` The transaction signer.
    /// - `airdrop_token_mint` The mint of the airdropped token.
    /// - `airdrop_token_program` The Token Program of the airdropped token.
    ///
    /// Parameters:
    /// - `amount` The amount to claw back.
    ///
    /// Requirements:
    /// - The signer must be the actual campaign creator.
    /// - No claim must be made,
    /// OR The current timestamp must not exceed 7 days after the first claim,
    /// OR The campaign must be expired.
    pub fn clawback(ctx: Context<Clawback>, amount: u64) -> Result<()> {
        instructions::clawback::handler(ctx, amount)
    }

    /// Collects the fees accumulated in the treasury by transferring them to the fee recipient.
    ///
    /// Notes:
    /// - Leaves a buffer of 0.001 SOL to ensure the account remains rent-exempt after the fee collection.
    /// - Emits a {FeesCollected} event.
    ///
    /// Accounts expected:
    /// - `fee_collector` The transaction signer and the fee collector.
    /// - `fee_recipient` The address receiving the collected fees.
    ///
    /// Requirements:
    /// - `fee_collector` must be authorized for fee collection.
    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        instructions::collect_fees::handler(ctx)
    }

    /// Creates a new airdrop campaign with instant distribution of tokens.
    ///
    /// Notes:
    /// - Emits a {CreateCampaign} event.
    /// - A value of zero for `expiration` means the campaign does not expire.
    ///
    /// Accounts expected:
    /// - `creator` The transaction signer and the campaign creator.
    /// - `airdrop_token_mint` The mint of the airdropped token.
    /// - `airdrop_token_program` The Token Program of the airdropped token.
    ///
    /// Parameters:
    /// - `merkle_root` The Merkle root of the claim data.
    /// - `expiration_time` The time when the campaign expires, in seconds since the Unix epoch. A value of zero means
    /// the campaign does not expire.
    /// - `name` The name of the campaign.
    /// - `ipfs_cid` The content identifier for indexing the contract on IPFS. An empty value may break certain UI
    /// features that depend upon the IPFS CID.
    /// - `aggregate_amount` The total amount of tokens to be distributed to all recipients.
    /// - `recipient_count` The total number of recipient addresses eligible for the airdrop.
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        merkle_root: [u8; 32],
        expiration_time: i64,
        name: String,
        ipfs_cid: String,
        aggregate_amount: u64,
        recipient_count: u32,
    ) -> Result<()> {
        instructions::create_campaign::handler(
            ctx,
            merkle_root,
            expiration_time,
            ipfs_cid,
            name,
            aggregate_amount,
            recipient_count,
        )
    }

    ////////////////////////////////////////////////////////////////////////////
    //                              READ-ONLY IXS                             //
    ////////////////////////////////////////////////////////////////////////////

    /// Initializes the program with the provided fee collector address by creating a Metaplex NFT collection.
    ///
    /// Accounts expected:
    /// - `initializer` The transaction signer.
    /// - `nft_token_program` The Token Program of the NFT collection.
    ///
    /// Parameters:
    /// - `fee_collector` The address that will have the authority to collect fees.
    pub fn initialize(ctx: Context<Initialize>, fee_collector: Pubkey) -> Result<()> {
        instructions::initialize::handler(ctx, fee_collector)
    }

    /// Retrieves the campaign details.
    ///
    /// Accounts expected:
    /// - `campaign` The account that stores the campaign details.
    pub fn campaign_view(ctx: Context<CampaignView>) -> Result<state::Campaign> {
        instructions::campaign_view::handler(ctx)
    }

    /// Returns a flag indicating whether a claim has been made for a given index.
    ///
    /// Accounts expected:
    /// - `campaign` The account that stores the campaign details.
    ///
    /// Parameters:
    /// - `index` The index of the recipient in the Merkle tree.
    pub fn has_claimed(ctx: Context<HasClaimed>, _index: u32) -> Result<bool> {
        Ok(!ctx.accounts.claim_receipt.data_is_empty())
    }

    /// Returns a flag indicating whether the campaign has expired.
    ///
    /// Accounts expected:
    /// - `campaign` The account that stores the campaign details.
    pub fn has_expired(ctx: Context<CampaignView>) -> Result<bool> {
        instructions::has_expired::handler(ctx)
    }

    /// Returns a flag indicating whether the campaign has passed the grace period.
    ///
    /// Notes:
    /// - A return value of `false` indicates:
    /// No claim has been made yet,
    /// OR the current timestamp does not exceed 7 days after the first claim,
    pub fn has_grace_period_passed(ctx: Context<CampaignView>) -> Result<bool> {
        instructions::has_grace_period_passed::handler(ctx)
    }
}
