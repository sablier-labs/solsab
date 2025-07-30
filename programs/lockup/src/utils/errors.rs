use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // Cancel Stream
    #[msg("Can't renounce an already-renounced Stream!")]
    StreamCanceled,
    #[msg("Can't cancel a non-cancelable Stream!")]
    StreamIsNotCancelable,
    #[msg("Can't cancel a settled Stream!")]
    StreamSettled,

    // Collect Fees
    #[msg("Can't collect zero fees!")]
    CantCollectZeroFees,

    // Create Stream
    #[msg("Cliff time zero but unlock amount not zero!")]
    CliffTimeZeroUnlockAmountNotZero,
    #[msg("Invalid cliff time of the Stream!")]
    CliffTimeNotLessThanEndTime,
    #[msg("Invalid deposit amount!")]
    DepositAmountZero,
    #[msg("Start time can't be zero!")]
    StartTimeNotPositive,
    #[msg("Start time must be less than cliff time!")]
    StartTimeNotLessThanCliffTime,
    #[msg("Start time must be less than end time!")]
    StartTimeNotLessThanEndTime,
    #[msg("Unlock amounts sum is greater than deposit amount!")]
    UnlockAmountsSumTooHigh,

    // Renounce
    #[msg("Can't renounce an already non cancelable Stream!")]
    StreamAlreadyNonCancelable,

    // Withdraw
    #[msg("Invalid Chainlink round!")]
    InvalidChainlinkRound,
    #[msg("Attempting to withdraw more than available in the stream!")]
    Overdraw,
    #[msg("Can't withdraw a zero amount!")]
    WithdrawAmountZero,

    // Common
    #[msg("Can't perform the action on a depleted stream!")]
    StreamDepleted,
}
