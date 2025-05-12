use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // TODO: Add the corresponding 0x codes, for a better readability of the tests
    // Create Campaign
    #[msg("Expiration time must be in the future!")]
    ExpirationTimeNotInTheFuture,

    // Claim
    #[msg("Invalid Merkle proof!")]
    InvalidMerkleProof,

    // Clawback
    #[msg("Can't clawback zero amount!")]
    CantClawbackZeroAmount,
    #[msg("Can't clawback more than remaining!")]
    CantClawbackMoreThanRemaining,

    // Collect Fees
    #[msg("Can't collect zero fees!")]
    CantCollectZeroFees,
}
