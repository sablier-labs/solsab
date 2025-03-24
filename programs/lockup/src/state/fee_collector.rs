use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct FeeCollectorData {
    pub bump: u8,
    pub address: Pubkey,
}
