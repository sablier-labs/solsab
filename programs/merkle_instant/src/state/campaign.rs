use anchor_lang::prelude::*;

use crate::utils::{constants::*, time::get_current_time};

/// Groups all the data for a Merkle Instant campaign.
#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub aggregate_amount: u64,
    pub airdrop_token_mint: Pubkey,
    pub airdrop_token_decimals: u8,
    pub bump: u8,
    pub campaign_start_time: u64,
    pub creator: Pubkey,
    pub expiration_time: u64,
    pub first_claim_time: u64,
    #[max_len(CAMPAIGN_IPFS_CID_SIZE as usize)]
    pub ipfs_cid: String,
    pub merkle_root: [u8; 32],
    #[max_len(CAMPAIGN_NAME_SIZE as usize)]
    pub name: String,
    pub recipient_count: u32,
}

impl Campaign {
    /// State update for the [`fn@crate::sablier_merkle_instant::claim`] instruction.
    pub fn claim(&mut self) -> Result<()> {
        // Update the first claim time to the current time.
        if self.first_claim_time == 0 {
            self.first_claim_time = get_current_time()?;
        }

        Ok(())
    }

    /// State update for the [`fn@crate::sablier_merkle_instant::create_campaign`] instruction.
    #[allow(clippy::too_many_arguments)]
    pub fn create(
        &mut self,
        aggregate_amount: u64,
        airdrop_token_decimals: u8,
        airdrop_token_mint: Pubkey,
        bump: u8,
        campaign_start_time: u64,
        creator: Pubkey,
        expiration_time: u64,
        ipfs_cid: String,
        merkle_root: [u8; 32],
        name: String,
        recipient_count: u32,
    ) -> Result<()> {
        self.aggregate_amount = aggregate_amount;
        self.airdrop_token_decimals = airdrop_token_decimals;
        self.airdrop_token_mint = airdrop_token_mint;
        self.bump = bump;
        self.campaign_start_time = campaign_start_time;
        self.creator = creator;
        self.expiration_time = expiration_time;
        self.ipfs_cid = ipfs_cid;
        self.merkle_root = merkle_root;
        self.name = name;
        self.recipient_count = recipient_count;
        Ok(())
    }
}
