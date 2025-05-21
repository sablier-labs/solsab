use anchor_lang::prelude::*;

#[event]
pub struct AirdropClaimed {
    pub amount: u64,
    pub campaign: Pubkey,
    pub claimer: Pubkey,
    pub claim_status: Pubkey,
    pub index: u32,
    pub merkle_proof: Vec<[u8; 32]>,
    pub recipient: Pubkey,
}

#[event]
pub struct CampaignCreated {
    pub aggregate_amount: u64,
    pub campaign: Pubkey,
    pub campaign_name: String,
    pub creator: Pubkey,
    pub expiration_time: i64,
    pub ipfs_id: String,
    pub merkle_root: [u8; 32],
    pub recipient_count: u32,
}

#[event]
pub struct CampaignFunded {
    pub amount: u64,
    pub campaign: Pubkey,
    pub funder: Pubkey,
}

#[event]
pub struct FeesCollected {
    pub fee_amount: u64,
    pub fee_collector: Pubkey,
    pub fee_recipient: Pubkey,
}

#[event]
pub struct FundsClawedBack {
    pub campaign: Pubkey,
    pub clawback_amount: u64,
    pub tx_signer: Pubkey,
}
