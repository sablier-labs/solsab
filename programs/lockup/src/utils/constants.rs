pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;

// Account Seeds
pub mod seeds {
    pub const EDITION_SEED: &[u8] = b"edition";
    pub const METADATA_SEED: &[u8] = b"metadata";
    pub const NFT_COLLECTION_DATA_SEED: &[u8] = b"nft_collection_data";
    pub const NFT_COLLECTION_MINT_SEED: &[u8] = b"nft_collection_mint";
    pub const STREAM_NFT_MINT_SEED: &[u8] = b"stream_nft_mint";
    pub const STREAM_DATA_SEED: &[u8] = b"stream_data";
    pub const TREASURY_SEED: &[u8] = b"treasury";
}

// NFT
pub mod nft_constants {
    pub const COLLECTION_METADATA_URI: &str =
        "https://ipfs.io/ipfs/bafkreiak467qbqncgpkmgqmu7hynjnqb5j33jjnkk6bcdda63m3lf7czca";
    pub const COLLECTION_NAME: &str = "Sablier LockupLinear Streams";
    pub const COLLECTION_SYMBOL: &str = "LL_STREAMS";
    pub const NFT_METADATA_URI: &str =
        "https://ipfs.io/ipfs/bafkreiaidfetl2iedxjzbh2hof7dj3hdrs5l7sr643ggtjh7sb42jcj5nq";
    pub const NFT_NAME_PREFIX: &str = "Sablier LL Stream #";
    pub const NFT_SYMBOL: &str = "LL_STREAM";
}
