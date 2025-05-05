use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // Create Campaign
    #[msg("Expiration time must be in the future!")]
    ExpirationTimeNotInTheFuture,

    // Clawback
    #[msg("Can't clawback zero amount!")]
    CantClawbackZeroAmount,
    #[msg("Can't clawback more than remaining!")]
    CantClawbackMoreThanRemaining,

    // Collect Fees
    #[msg("Can't collect zero fees!")]
    CantCollectZeroFees,
}
