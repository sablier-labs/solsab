use anchor_lang::prelude::*;

use crate::utils::constants::*;

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub airdrop_token_mint: Pubkey,
    pub bump: u8,
    pub creator: Pubkey,
    pub expiration_time: i64,
    pub first_claim_time: i64,
    #[max_len(CAMPAIGN_IPFS_CID_SIZE as usize)]
    pub ipfs_cid: String,
    pub merkle_root: [u8; 32],
    #[max_len(CAMPAIGN_NAME_SIZE as usize)]
    pub name: String,
}

impl Campaign {
    pub fn claim(&mut self) -> Result<()> {
        // Update the first claim time to the current time.
        if self.first_claim_time == 0 {
            self.first_claim_time = Clock::get()?.unix_timestamp;
        }

        Ok(())
    }

    // State update for the `create_campaign` instruction.
    #[allow(clippy::too_many_arguments)]
    pub fn create(
        &mut self,
        airdrop_token_mint: Pubkey,
        bump: u8,
        creator: Pubkey,
        expiration_time: i64,
        ipfs_cid: String,
        merkle_root: [u8; 32],
        name: String,
    ) -> Result<()> {
        self.airdrop_token_mint = airdrop_token_mint;
        self.bump = bump;
        self.creator = creator;
        self.expiration_time = expiration_time;
        self.ipfs_cid = ipfs_cid;
        self.merkle_root = merkle_root;
        self.name = name;

        Ok(())
    }
}
