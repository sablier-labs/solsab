pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;
pub const LAMPORTS_PER_SOL: u64 = 1e9 as u64; // 1 billion lamports in 1 SOL

// Account Seeds
pub mod seeds {
    pub const TREASURY: &[u8] = b"treasury";
}
