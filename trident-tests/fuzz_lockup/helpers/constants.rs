// =============================================================================
// AMOUNTS
// =============================================================================
pub const TOKEN_DECIMALS: u8 = 6;
pub const DECIMALS_MULTIPLIER: u64 = 10u64.pow(TOKEN_DECIMALS as u32);

pub const CLIFF_AMOUNT: u64 = 2500 * DECIMALS_MULTIPLIER + 1; // 2500.000001 tokens
pub const DEPOSIT_AMOUNT: u64 = 10_000 * DECIMALS_MULTIPLIER; // 10,000 tokens
pub const START_AMOUNT: u64 = 0;

// =============================================================================
// TIMESTAMPS
// =============================================================================
pub const GENESIS: u64 = 1754142441; // August 2, 2025 1:47:21 PM

pub const CLIFF_DURATION: u64 = 2500;
pub const TOTAL_DURATION: u64 = 10_000;

pub const CLIFF_TIME: u64 = GENESIS + CLIFF_DURATION;
pub const END_TIME: u64 = GENESIS + TOTAL_DURATION;
pub const START_TIME: u64 = GENESIS + 1000;

// =============================================================================
// LAMPORTS
// =============================================================================
pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
pub const DEFAULT_LAMPORTS_BALANCE: u64 = 5 * LAMPORTS_PER_SOL;

// =============================================================================
// PROGRAM IDS
// =============================================================================
pub const SPL_TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
// pub const TOKEN2022_PROGRAM_ID: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
pub const ASSOCIATED_TOKEN_PROGRAM_ID: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
pub const TOKEN_METADATA_PROGRAM_ID: &str = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

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
