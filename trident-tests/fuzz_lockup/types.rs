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

