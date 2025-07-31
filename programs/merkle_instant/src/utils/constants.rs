pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;
// The fee amount in USD, denominated in Chainlink's 8-decimal format for USD prices, where 1e8 is $1.
pub const CLAIM_FEE_USD: u64 = 2e8 as u64;
pub const LAMPORTS_PER_SOL: u64 = 1e9 as u64; // 1 billion lamports in 1 SOL
pub const CAMPAIGN_IPFS_CID_SIZE: usize = 59;
pub const CAMPAIGN_NAME_SIZE: usize = 32;

// Account Seeds
pub mod seeds {
    pub const CAMPAIGN_SEED: &[u8] = b"campaign";
    pub const CLAIM_RECEIPT_SEED: &[u8] = b"claim_receipt";
    pub const TREASURY_SEED: &[u8] = b"treasury";
}
