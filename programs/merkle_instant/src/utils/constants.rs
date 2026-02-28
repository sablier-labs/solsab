// Re-export shared constants so that they are accessible via `crate::utils::constants::*`.
pub use sablier_common::constants::*;

// The fee amount in USD, denominated in Chainlink's 8-decimal format for USD prices, where 1e8 is $1.
// Currently set to 0.
pub const CLAIM_FEE_USD: u64 = 0;
pub const CAMPAIGN_IPFS_CID_SIZE: usize = 59;
pub const CAMPAIGN_NAME_SIZE: usize = 32;

// Account Seeds
pub mod seeds {
    pub use sablier_common::constants::seeds::TREASURY;

    pub const CAMPAIGN: &[u8] = b"campaign";
    pub const CLAIM_RECEIPT: &[u8] = b"claim_receipt";
}
