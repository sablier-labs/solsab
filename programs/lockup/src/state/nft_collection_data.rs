use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct NftCollectionData {
    pub total_supply: u64,
    pub bump: u8,
}

impl NftCollectionData {
    /// State update for the [`crate::sablier_lockup::create_with_timestamps`] instruction.
    pub fn create(&mut self) -> Result<()> {
        // The increment is safe, as it would take many years to overflow 2^64.
        self.total_supply += 1;

        Ok(())
    }

    /// State update for the [`crate::sablier_lockup::initialize`] instruction.
    pub fn initialize(&mut self, bump: u8) -> Result<()> {
        self.bump = bump;
        self.total_supply = 0;

        Ok(())
    }
}
