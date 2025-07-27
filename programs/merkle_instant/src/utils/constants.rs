// Account Seeds
pub mod seeds {
    pub const CAMPAIGN_SEED: &[u8] = b"campaign";
    pub const CLAIM_RECEIPT_SEED: &[u8] = b"claim_receipt";
    pub const TREASURY_SEED: &[u8] = b"treasury";
}

// Miscellaneous
pub mod misc {
    pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;
    pub const CLAIM_FEE_USD: u64 = 2; // 2 USD
    pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000; // 1 billion lamports in 1 SOL
    pub const CAMPAIGN_IPFS_CID_SIZE: usize = 59;
    pub const CAMPAIGN_NAME_SIZE: usize = 32;
}
