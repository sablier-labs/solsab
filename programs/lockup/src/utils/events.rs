use anchor_lang::prelude::*;

/// Emitted when a stream is canceled.
#[event]
pub struct CancelLockupStream {
    pub deposited_token_mint: Pubkey,
    pub recipient_amount: u64,
    pub sender_amount: u64,
    pub stream_data: Pubkey,
    pub stream_nft: Pubkey,
}

/// Emitted when a Lockup Linear stream is created.
#[event]
pub struct CreateLockupLinearStream {
    pub deposit_token_decimals: u8,
    pub deposit_token_mint: Pubkey,
    pub recipient: Pubkey,
    pub salt: u128,
    pub stream_data: Pubkey,
    pub stream_nft: Pubkey,
}

/// Emitted when a Lockup Tranched stream is created.
#[event]
pub struct CreateLockupTranchedStream {
    pub deposit_token_decimals: u8,
    pub deposit_token_mint: Pubkey,
    pub recipient: Pubkey,
    pub salt: u128,
    pub stream_data: Pubkey,
    pub stream_nft_mint: Pubkey,
    pub tranche_count: u32,
}

/// Emitted when fees are collected from the treasury.
#[event]
pub struct FeesCollected {
    pub fee_amount: u64,
    pub fee_collector: Pubkey,
    pub fee_recipient: Pubkey,
}

/// Emitted when a sender gives up the right to cancel a stream.
#[event]
pub struct RenounceLockupStream {
    pub deposited_token_mint: Pubkey,
    pub stream_data: Pubkey,
    pub stream_nft: Pubkey,
}

/// Emitted when tokens are withdrawn from a stream.
#[event]
pub struct WithdrawFromLockupStream {
    pub deposited_token_mint: Pubkey,
    pub fee_in_lamports: u64,
    pub stream_data: Pubkey,
    pub stream_nft: Pubkey,
    pub withdrawn_amount: u64,
}
