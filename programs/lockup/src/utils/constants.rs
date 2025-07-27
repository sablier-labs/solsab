// Account Seeds
pub mod seeds {
    pub const EDITION: &[u8] = b"edition";
    pub const METADATA: &[u8] = b"metadata";
    pub const NFT_COLLECTION_DATA: &[u8] = b"nft_collection_data";
    pub const NFT_COLLECTION_MINT: &[u8] = b"nft_collection_mint";
    pub const STREAM_NFT_MINT: &[u8] = b"stream_nft_mint";
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

// Miscellaneous
pub mod misc {
    pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;
    pub const WITHDRAWAL_FEE_USD: u64 = 1; // 1 USD
    pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000; // 1 billion lamports in 1 SOL
}
