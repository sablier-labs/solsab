use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct NftCollectionData {
    pub total_supply: u64,
    pub bump: u8,
}
