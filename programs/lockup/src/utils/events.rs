use anchor_lang::prelude::*;

#[event]
pub struct CancelLockupStream {
    pub deposit_token_mint: Pubkey,
    pub recipient_amount: u64,
    pub sender_amount: u64,
    pub stream_data: Pubkey,
    pub stream_nft_mint: Pubkey,
}

#[event]
pub struct CreateLockupLinearStream {
    pub asset_decimals: u8,
    pub deposit_token_mint: Pubkey,
    pub recipient: Pubkey,
    pub salt: u128,
    pub stream_data: Pubkey,
    pub stream_nft_mint: Pubkey,
}

#[event]
pub struct FeesCollected {
    pub fee_amount: u64,
    pub fee_collector: Pubkey,
    pub fee_recipient: Pubkey,
}

#[event]
pub struct RenounceLockupStream {
    pub deposited_token_mint: Pubkey,
    pub stream_data: Pubkey,
    pub stream_nft_mint: Pubkey,
}

#[event]
pub struct WithdrawFromLockupStream {
    pub deposited_token_mint: Pubkey,
    pub stream_data: Pubkey,
    pub stream_nft_mint: Pubkey,
    pub withdrawn_amount: u64,
}
