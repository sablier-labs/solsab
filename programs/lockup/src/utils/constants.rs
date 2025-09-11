pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;
// The fee amount in USD, denominated in Chainlink's 8-decimal format for USD prices, where 1e8 is $1.
pub const WITHDRAWAL_FEE_USD: u64 = 1e8 as u64;
pub const LAMPORTS_PER_SOL: u64 = 1e9 as u64; // 1 billion lamports in 1 SOL

// Account Seeds
pub mod seeds {
    pub const STREAM_NFT_COLLECTION: &[u8] = b"stream_nft_collection";
    pub const STREAM_NFT: &[u8] = b"stream_nft";
    pub const STREAM_DATA: &[u8] = b"stream_data";
    pub const TREASURY: &[u8] = b"treasury";
}

// NFT
pub mod nft {
    pub const COLLECTION_METADATA_URI: &str =
        "https://ipfs.io/ipfs/bafkreiak467qbqncgpkmgqmu7hynjnqb5j33jjnkk6bcdda63m3lf7czca";
    pub const COLLECTION_NAME: &str = "Sablier LockupLinear Streams";
    pub const COLLECTION_SYMBOL: &str = "LL_STREAMS";
    pub const NFT_METADATA_URI: &str =
        "https://ipfs.io/ipfs/bafkreiaidfetl2iedxjzbh2hof7dj3hdrs5l7sr643ggtjh7sb42jcj5nq";
    pub const NFT_NAME_PREFIX: &str = "Sablier LL Stream #";
    pub const NFT_SYMBOL: &str = "LL_STREAM";
}
