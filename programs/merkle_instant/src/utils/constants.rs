pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;

// Account Seeds
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const CAMPAIGN_SEED: &[u8] = b"campaign";
pub const CLAIM_STATUS_SEED: &[u8] = b"claim_status";
pub const CLAIM_STATUS_SIZE: usize = 4_294_967_295; // u32::MAX
pub const CAMPAIGN_NAME_SIZE: usize = 32;
pub const CAMPAIGN_IPFS_ID_SIZE: usize = 32;
