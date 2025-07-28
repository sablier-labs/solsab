use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // Claim
    #[msg("Campaign has expired!")]
    CampaignExpired,
    #[msg("Invalid Merkle proof!")]
    InvalidMerkleProof,

    // Clawback
    #[msg("Clawback not allowed past the grace period and before campaign expiration!")]
    ClawbackNotAllowed,

    // Collect Fees
    #[msg("Can't collect zero fees!")]
    CantCollectZeroFees,
}
