use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid cliff time of the Stream!")]
    InvalidCliffTime,
    #[msg("Invalid deposit amount!")]
    InvalidDepositAmount,
    #[msg("Stream end time cannot be in the past!")]
    InvalidEndTime,
    #[msg("Invalid withdrawal amount!")]
    InvalidWithdrawalAmount,
    #[msg("Can't cancel a non-cancelable Stream!")]
    StreamIsNotCancelable,
    #[msg("Can't renounce an already-renounced Stream!")]
    StreamCancelabilityIsAlreadyRenounced,
    #[msg("Can't withdraw a zero amount!")]
    WithdrawalAmountCannotBeZero,
}
