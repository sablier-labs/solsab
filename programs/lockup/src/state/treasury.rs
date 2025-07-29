use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub bump: u8,
    pub fee_collector: Pubkey,
}

impl Treasury {
    /// State update for the [`crate::sablier_lockup::initialize`] instruction.
    pub fn initialize(&mut self, bump: u8, fee_collector: Pubkey) -> Result<()> {
        self.bump = bump;
        self.fee_collector = fee_collector;

        Ok(())
    }
}
