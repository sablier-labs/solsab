use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // Cancel Stream
    #[msg("Can't renounce an already-renounced Stream!")]
    StreamCanceled, // 0x1770
    #[msg("Can't cancel a non-cancelable Stream!")]
    StreamIsNotCancelable, // 0x1771
    #[msg("Can't cancel a settled Stream!")]
    StreamSettled, // 0x1772

    // Collect Fees
    #[msg("Can't collect zero fees!")]
    CantCollectZeroFees, // 0x1773
    #[msg("Not enough fees for withdrawal!")]
    NotEnoughFeesForWithdrawal, // 0x1774

    // Create Stream
    #[msg("Cliff time zero but unlock amount not zero!")]
    CliffTimeZeroUnlockAmountNotZero, // 0x1775
    #[msg("Invalid cliff time of the Stream!")]
    CliffTimeNotLessThanEndTime, // 0x1776
    #[msg("Invalid deposit amount!")]
    InvalidDepositAmount, // 0x1777
    #[msg("Start time can't be zero!")]
    StartTimeZero, // 0x1778 // Fixed from 0x177a
    #[msg("Start time must be less than cliff time!")]
    StartTimeNotLessThanCliffTime, // 0x1779 // Fixed from 0x177b
    #[msg("Start time must be less than end time!")]
    StartTimeNotLessThanEndTime, // 0x177a // Fixed from 0x177c
    #[msg("Unlock amounts sum is greater than deposit amount!")]
    UnlockAmountsSumTooHigh, // 0x177b // Fixed from 0x177d

    // Renounce
    #[msg("Can't renounce an already non cancelable Stream!")]
    StreamAlreadyNonCancelable, // 0x177c // Fixed from 0x177f

    // Withdraw
    #[msg("Withdraw zero tokens from a stream!")]
    Overdraw, // 0x177d // Fixed from 0x1780
    #[msg("Can't withdraw a zero amount!")]
    WithdrawAmountZero, // 0x177e // Fixed from 0x1781
}
