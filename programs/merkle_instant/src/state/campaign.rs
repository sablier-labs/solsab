use anchor_lang::prelude::*;

use crate::utils::constants::*;

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub bump: u8,
    #[max_len(CAMPAIGN_NAME_SIZE as usize)]
    pub name: String,
    pub airdrop_token_mint: Pubkey,
    #[max_len(CAMPAIGN_IPFS_ID_SIZE as usize)]
    pub merkle_tree_ipfs_id: String,
    pub merkle_root: [u8; 32],
    pub expiration_time: i64,
    pub creator: Pubkey,
}

impl Campaign {
    // State update for the `initialize` instruction.
    pub fn initialize(
        &mut self,
        bump: u8,
        name: String,
        airdrop_token_mint: Pubkey,
        merkle_tree_ipfs_id: String,
        merkle_root: [u8; 32],
        expiration_time: i64,
        creator: Pubkey,
    ) -> Result<()> {
        self.bump = bump;
        self.name = name;
        self.airdrop_token_mint = airdrop_token_mint;
        self.merkle_tree_ipfs_id = merkle_tree_ipfs_id;
        self.merkle_root = merkle_root;
        self.expiration_time = expiration_time;
        self.creator = creator;

        Ok(())
    }
}
