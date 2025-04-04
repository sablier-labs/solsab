use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct NftCollectionData {
    pub total_supply: u64,
    pub bump: u8,
}

impl NftCollectionData {
    // State update for the `initialize` instruction.
    pub fn initialize(&mut self, bump: u8) -> Result<()> {
        self.bump = bump;
        self.total_supply = 0;

        Ok(())
    }
}
