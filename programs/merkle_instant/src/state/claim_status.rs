use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ClaimStatus {
    pub bump: u8,
}
