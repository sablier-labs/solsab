use anchor_lang::prelude::*;

#[event]
pub struct AirdropClaimed {
    pub campaign: Pubkey,
    pub claimer: Pubkey,
    pub recipient: Pubkey,
    pub leaf_id: u32,
    pub amount: u64,
    pub proof: Vec<[u8; 32]>,
}

#[event]
pub struct CampaignCreated {
    pub campaign: Pubkey,
    pub creator: Pubkey,
    pub campaign_name: String,
    pub recipient_count: u32,
    pub ipfs_id: String,
    pub merkle_root: [u8; 32],
    pub expiration_time: i64,
}

#[event]
pub struct CampaignFunded {
    pub campaign: Pubkey,
    pub funder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct FeesCollected {
    pub fee_collector: Pubkey,
    pub fee_recipient: Pubkey,
    pub fee_amount: u64,
}

#[event]
pub struct FundsClawedBack {
    pub campaign: Pubkey,
    pub clawback_amount: u64,
    pub tx_signer: Pubkey,
}
