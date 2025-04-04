use anchor_lang::prelude::*;

#[event]
pub struct CancelLockupStream {
    pub stream_id: u64,
    pub refunded_amount: u64,
}

#[event]
pub struct CreateLockupLinearStream {
    pub stream_id: u64,
    pub recipient: Pubkey,
}
#[event]
pub struct FeesCollected {
    pub fee_collector: Pubkey,
    pub fee_recipient: Pubkey,
    pub lamports_amount: u64,
}

#[event]
pub struct RenounceLockupStream {
    pub stream_id: u64,
}

#[event]
pub struct WithdrawFromLockupStream {
    pub stream_id: u64,
    pub withdrawn_amount: u64,
}

#[event]
pub struct WithdrawableAmountQueried {
    pub stream_id: u64,
    pub withdrawable_amount: u64,
}
