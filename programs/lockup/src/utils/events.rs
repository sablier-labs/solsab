use anchor_lang::prelude::*;

#[event]
pub struct FeeCollection {
    pub fee_collector: Pubkey,
    pub fee_recipient: Pubkey,
    pub lamports_amount: u64,
}

#[event]
pub struct StreamCancelation {
    pub stream_id: u64,
    pub refunded_amount: u64,
}

#[event]
pub struct StreamCreation {
    pub stream_id: u64,
    pub asset_decimals: u8,
    pub recipient: Pubkey,
}

#[event]
pub struct StreamRenouncement {
    pub stream_id: u64,
}

#[event]
pub struct StreamWithdrawal {
    pub stream_id: u64,
    pub withdrawn_amount: u64,
}

#[event]
pub struct WithdrawableAmountQueried {
    pub stream_id: u64,
    pub withdrawable_amount: u64,
}
