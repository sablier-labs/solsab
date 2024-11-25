use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid cliff time of the Stream!")]
    InvalidCliffTime,
    #[msg("Invalid deposit amount!")]
    InvalidDepositAmount,
    #[msg("Invalid start or end time of the Stream!")]
    InvalidStartOrEndTime,
    #[msg("Invalid withdrawal amount!")]
    InvalidWithdrawalAmount,
    #[msg("Can't cancel a non-cancelable Stream!")]
    StreamIsNotCancelable,
    #[msg("Can't renounce an already-renounced Stream!")]
    StreamCancelabilityIsAlreadyRenounced,
    #[msg("Can't withdraw a zero amount!")]
    WithdrawalAmountCannotBeZero,
}
