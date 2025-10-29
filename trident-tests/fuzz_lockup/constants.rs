// =============================================================================
// TIMESTAMPS
// =============================================================================
pub const GENESIS: u64 = 1754142441; // August 2, 2025 1:47:21 PM
pub const ONE_MONTH_SECONDS: u64 = 30 * 24 * 60 * 60;

// =============================================================================
// LAMPORTS
// =============================================================================
pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
pub const DEFAULT_LAMPORTS_BALANCE: u64 = 5 * LAMPORTS_PER_SOL;

// =============================================================================
// PROGRAM IDS
// =============================================================================
pub const SYSTEM_PROGRAM_ID: &str = "11111111111111111111111111111111";
pub const SPL_TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
// pub const TOKEN2022_PROGRAM_ID: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

// Chainlink IDS
pub const CHAINLINK_PROGRAM_ID: &str = "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny";
pub const CHAINLINK_SOL_USD_FEED_ID: &str = "99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR";

// =============================================================================
// PDA SEEDS
// =============================================================================
pub const NFT_COLLECTION_DATA: &[u8] = b"nft_collection_data";
pub const NFT_COLLECTION_MINT: &[u8] = b"nft_collection_mint";
pub const TREASURY: &[u8] = b"treasury";
pub const METADATA: &[u8] = b"metadata";
pub const EDITION: &[u8] = b"edition";
pub const STREAM_NFT_MINT: &[u8] = b"stream_nft_mint";
pub const STREAM_DATA: &[u8] = b"stream_data";
