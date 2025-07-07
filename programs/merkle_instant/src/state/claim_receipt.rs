use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
// This struct is declared as empty to avoid manually allocating space.
pub struct ClaimReceipt {}
