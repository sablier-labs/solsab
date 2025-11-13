use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

/// File containing all custom types which can be used
/// in transactions and instructions or invariant checks.
///
/// You can define your own custom types here.

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct Amounts {
    pub start_unlock: u64,

    pub cliff_unlock: u64,

    pub deposited: u64,

    pub refunded: u64,

    pub withdrawn: u64,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct CancelLockupStream {
    pub deposited_token_mint: TridentPubkey,

    pub recipient_amount: u64,

    pub sender_amount: u64,

    pub stream_data: TridentPubkey,

    pub stream_nft_mint: TridentPubkey,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct CreateLockupLinearStream {
    pub deposit_token_decimals: u8,

    pub deposit_token_mint: TridentPubkey,

    pub recipient: TridentPubkey,

    pub salt: u128,

    pub stream_data: TridentPubkey,

    pub stream_nft_mint: TridentPubkey,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct FeesCollected {
    pub fee_amount: u64,

    pub fee_collector: TridentPubkey,

    pub fee_recipient: TridentPubkey,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct NftCollectionData {
    pub total_supply: u64,

    pub bump: u8,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct RenounceLockupStream {
    pub deposited_token_mint: TridentPubkey,

    pub stream_data: TridentPubkey,

    pub stream_nft_mint: TridentPubkey,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct StreamData {
    pub amounts: Amounts,

    pub deposited_token_mint: TridentPubkey,

    pub bump: u8,

    pub salt: u128,

    pub is_cancelable: bool,

    pub is_depleted: bool,

    pub timestamps: Timestamps,

    pub sender: TridentPubkey,

    pub was_canceled: bool,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub enum StreamStatus {
    #[default]
    Pending,

    Streaming,

    Settled,

    Canceled,

    Depleted,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct Timestamps {
    pub cliff: u64,

    pub end: u64,

    pub start: u64,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct Treasury {
    pub bump: u8,

    pub fee_collector: TridentPubkey,

    pub chainlink_program: TridentPubkey,

    pub chainlink_sol_usd_feed: TridentPubkey,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct WithdrawFromLockupStream {
    pub deposited_token_mint: TridentPubkey,

    pub fee_in_lamports: u64,

    pub stream_data: TridentPubkey,

    pub stream_nft_mint: TridentPubkey,

    pub withdrawn_amount: u64,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct Campaign {
    pub airdrop_token_mint: TridentPubkey,

    pub bump: u8,

    pub campaign_start_time: u64,

    pub creator: TridentPubkey,

    pub expiration_time: u64,

    pub first_claim_time: u64,

    pub ipfs_cid: String,

    pub merkle_root: [u8; 32],

    pub name: String,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct Claim {
    pub amount: u64,

    pub campaign: TridentPubkey,

    pub claimer: TridentPubkey,

    pub claim_receipt: TridentPubkey,

    pub fee_in_lamports: u64,

    pub index: u32,

    pub recipient: TridentPubkey,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct ClaimReceipt {}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct Clawback {
    pub amount: u64,

    pub campaign: TridentPubkey,

    pub campaign_creator: TridentPubkey,

    pub clawback_recipient: TridentPubkey,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct CreateCampaign {
    pub aggregate_amount: u64,

    pub campaign: TridentPubkey,

    pub campaign_name: String,

    pub campaign_start_time: u64,

    pub creator: TridentPubkey,

    pub expiration_time: u64,

    pub ipfs_cid: String,

    pub merkle_root: [u8; 32],

    pub recipient_count: u32,

    pub token_decimals: u8,

    pub token_mint: TridentPubkey,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct FeesCollected {
    pub fee_amount: u64,

    pub fee_collector: TridentPubkey,

    pub fee_recipient: TridentPubkey,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct Treasury {
    pub bump: u8,

    pub fee_collector: TridentPubkey,

    pub chainlink_program: TridentPubkey,

    pub chainlink_sol_usd_feed: TridentPubkey,
}
