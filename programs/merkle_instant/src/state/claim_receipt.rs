use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ClaimReceipt {
    pub bump: u8,
}
