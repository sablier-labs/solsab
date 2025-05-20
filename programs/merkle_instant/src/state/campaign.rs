use anchor_lang::prelude::*;

use crate::utils::constants::*;

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub airdrop_token_mint: Pubkey,
    pub bump: u8,
    // TODO: what's the appropriate max length?
    // TODO: does this negatively affect the size of the account if the actual number of recipients is low? Write a
    // test to check this.
    #[max_len(CLAIM_STATUS_SIZE as usize)] // u32::MAX
    pub claim_status: Vec<bool>,
    pub creator: Pubkey,
    pub expiration_time: i64,
    #[max_len(CAMPAIGN_IPFS_ID_SIZE as usize)]
    pub ipfs_id: String,
    pub merkle_root: [u8; 32],
    #[max_len(CAMPAIGN_NAME_SIZE as usize)]
    pub name: String,
}

impl Campaign {
    // State update for the `create_campaign` instruction.
    pub fn create(
        &mut self,
        bump: u8,
        name: String,
        airdrop_token_mint: Pubkey,
        ipfs_id: String,
        merkle_root: [u8; 32],
        expiration_time: i64,
        creator: Pubkey,
        recipient_count: u32,
    ) -> Result<()> {
        self.bump = bump;
        self.name = name;
        self.airdrop_token_mint = airdrop_token_mint;
        self.ipfs_id = ipfs_id;
        self.merkle_root = merkle_root;
        self.expiration_time = expiration_time;
        self.creator = creator;
        self.claim_status = vec![false; recipient_count as usize];

        Ok(())
    }
}
