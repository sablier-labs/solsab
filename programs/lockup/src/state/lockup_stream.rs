use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize};

#[account]
#[derive(InitSpace)]
pub struct Stream {
    pub sender_ata: Pubkey,
    pub recipient_ata: Pubkey,
    pub token_mint_account: Pubkey,
    pub amounts: Amounts,
    pub milestones: Milestones,
    pub is_cancelable: bool,
    pub was_canceled: bool,
    pub bump: u8,
}

enum LockupModel {
    Dynamic,
    Linear,
    Tranche,
}

#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Amounts {
    pub deposited: u64,
    pub withdrawn: u64,
    pub refunded: u64,
}

#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Milestones {
    pub start_time: i64,
    pub cliff_time: i64,
    pub end_time: i64,
}
