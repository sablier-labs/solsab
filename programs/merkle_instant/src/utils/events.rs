use anchor_lang::prelude::*;

#[event]
pub struct CampaignCreated {
    pub campaign: Pubkey,
    pub creator: Pubkey,
    pub campaign_name: String,
    pub no_of_recipients: u32,
    pub expiration: i64,
    pub merkle_tree_ipfs_id: String,
    pub merkle_root: [u8; 32],
}

#[event]
pub struct CampaignFunded {
    pub campaign: Pubkey,
    pub funder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct FundsClawedBack {
    pub campaign: Pubkey,
    pub clawback_amount: u64,
    pub tx_signer: Pubkey,
}

#[event]
pub struct FeesCollected {
    pub fee_collector: Pubkey,
    pub fee_recipient: Pubkey,
    pub fee_amount: u64,
}
