use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub bump: u8,
    pub fee_collector: Pubkey,
    pub chainlink_program: Pubkey,
    pub chainlink_sol_usd_feed: Pubkey,
}

impl Treasury {
    // State update for the `initialize` instruction.
    pub fn initialize(
        &mut self,
        bump: u8,
        fee_collector: Pubkey,
        chainlink_program: Pubkey,
        chainlink_sol_usd_feed: Pubkey,
    ) -> Result<()> {
        self.bump = bump;
        self.fee_collector = fee_collector;
        self.chainlink_program = chainlink_program;
        self.chainlink_sol_usd_feed = chainlink_sol_usd_feed;

        Ok(())
    }
}
