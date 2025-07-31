use anchor_lang::prelude::*;

use crate::utils::constants::*;

/// Represents a Merkle Instant campaign for token airdrops.
///
/// Note: All timestamp fields (`campaign_start_time`, `expiration_time`, `first_claim_time`)
/// use `i64` instead of the more intuitive `u64` to maintain compatibility with Solana's
/// standard time representation. The Solana `Clock` struct returns Unix timestamps as `i64`,
/// and using consistent types across the codebase prevents unnecessary type conversions and
/// potential issues when interfacing with Solana's time-related syscalls and built-in functions.
#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub airdrop_token_mint: Pubkey,
    pub bump: u8,
    pub campaign_start_time: i64,
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
        campaign_start_time: i64,
        creator: Pubkey,
        expiration_time: i64,
        ipfs_cid: String,
        merkle_root: [u8; 32],
        name: String,
    ) -> Result<()> {
        self.airdrop_token_mint = airdrop_token_mint;
        self.bump = bump;
        self.campaign_start_time = campaign_start_time;
        self.creator = creator;
        self.expiration_time = expiration_time;
        self.ipfs_cid = ipfs_cid;
        self.merkle_root = merkle_root;
        self.name = name;

        Ok(())
    }
}
