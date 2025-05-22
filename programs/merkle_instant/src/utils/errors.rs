use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // TODO: Add the corresponding 0x codes, for a better readability of the tests
    // Create Campaign
    #[msg("Expiration time must be in the future!")]
    ExpirationTimeNotInTheFuture,

    // Claim
    #[msg("Campaign has expired!")]
    CampaignExpired,
    #[msg("Invalid Merkle proof!")]
    InvalidMerkleProof,

    // Clawback
    #[msg("Campaign not within grace period or campaign has not expired!")]
    ClawbackNotAllowed,
    #[msg("Can't clawback more than remaining!")]
    CantClawbackMoreThanRemaining,

    // Collect Fees
    #[msg("Can't collect zero fees!")]
    CantCollectZeroFees,
}
