use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize};

#[account]
#[derive(InitSpace)]
pub struct StreamData {
    pub amounts: Amounts,
    pub asset_mint: Pubkey,
    pub bump: u8,
    pub id: u64,
    pub is_cancelable: bool,
    pub milestones: Milestones,
    pub recipient: Pubkey,
    pub sender: Pubkey,
    pub was_canceled: bool,
}

#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Amounts {
    pub deposited: u64,
    pub refunded: u64,
    pub withdrawn: u64,
}

#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Milestones {
    pub cliff_time: i64,
    pub end_time: i64,
    pub start_time: i64,
}
