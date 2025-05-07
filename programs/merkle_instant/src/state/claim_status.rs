use anchor_lang::prelude::*;

use crate::utils::constants::*;

#[account]
#[derive(InitSpace)]
pub struct ClaimStatus {
    // TODO: what's the appropriate max length?
    // TODO: does this negatively affect the size of the account if the actual number of recipients is low?
    #[max_len(CLAIM_STATUS_SIZE as usize)] // u32::MAX
    pub claimed_bitmap: Vec<bool>,
    pub bump: u8,
}

impl ClaimStatus {
    // State update for the `initialize` instruction.
    pub fn initialize(&mut self, bump: u8, no_of_recipients: u32) -> Result<()> {
        self.bump = bump;
        self.claimed_bitmap = vec![false; no_of_recipients as usize];

        Ok(())
    }
}
