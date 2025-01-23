use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub bump: u8,
}
