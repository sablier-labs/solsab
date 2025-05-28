use anchor_lang::prelude::*;

#[event]
pub struct CancelLockupStream {
    pub asset_mint: Pubkey,
    pub sender_amount: u64,
    pub recipient_amount: u64,
}

#[event]
pub struct CreateLockupLinearStream {
    pub salt: u128,
    pub asset_decimals: u8,
    pub recipient: Pubkey,
}
#[event]
pub struct FeesCollected {
    pub fee_collector: Pubkey,
    pub fee_recipient: Pubkey,
    pub fee_amount: u64,
}

#[event]
pub struct RenounceLockupStream {}

#[event]
pub struct WithdrawFromLockupStream {
    pub withdrawn_amount: u64,
}
