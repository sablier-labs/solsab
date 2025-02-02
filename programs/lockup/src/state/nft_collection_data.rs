use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct NftCollectionData {
    pub nfts_total_supply: u64,
    pub bump: u8,
}
