use anchor_lang::prelude::*;

#[event]
pub struct CreateCampaign {
    pub aggregate_amount: u64,
    pub campaign: Pubkey,
    pub campaign_name: String,
    pub creator: Pubkey,
    pub expiration_time: i64,
    pub ipfs_cid: String,
    pub merkle_root: [u8; 32],
    pub recipient_count: u32,
    pub token_decimals: u8,
    pub token_mint: Pubkey,
}

#[event]
pub struct Claim {
    pub amount: u64,
    pub campaign: Pubkey,
    pub claimer: Pubkey,
    pub claim_receipt: Pubkey,
    pub fee_in_lamports: u64,
    pub index: u32,
    pub recipient: Pubkey,
}

#[event]
pub struct Clawback {
    pub amount: u64,
    pub campaign: Pubkey,
    pub campaign_creator: Pubkey,
}

#[event]
pub struct FeesCollected {
    pub fee_amount: u64,
    pub fee_collector: Pubkey,
    pub fee_recipient: Pubkey,
}
