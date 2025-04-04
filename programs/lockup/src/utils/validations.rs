use anchor_lang::prelude::*;

use crate::utils::errors::ErrorCode;

pub fn check_cancel(
    is_cancelable: bool,
    was_canceled: bool,
    streamed_amount: u64,
    deposited_amount: u64,
) -> Result<()> {
    // Check: the stream is not canceled.
    if was_canceled {
        return Err(ErrorCode::StreamCanceled.into());
    }

    // Check: the stream is cancelable.
    if !is_cancelable {
        return Err(ErrorCode::StreamIsNotCancelable.into());
    }

    // Check: the stream is not settled.
    if streamed_amount >= deposited_amount {
        return Err(ErrorCode::StreamSettled.into());
    }

    Ok(())
}

pub fn check_collect_fees(lamports_amount: u64, collectable_amount: u64) -> Result<()> {
    // Check: the withdraw amount is not zero.
    if lamports_amount == 0 {
        return Err(ErrorCode::CantCollectZeroFees.into());
    }

    // Check: the collect amount is not greater than the Treasury's collectable amount.
    if collectable_amount < lamports_amount {
        return Err(ErrorCode::NotEnoughFeesForWithdrawal.into());
    }

    Ok(())
}

// Validate the parameters for creating a Stream
pub fn check_create(
    deposited_amount: u64,
    start_time: i64,
    cliff_time: i64,
    end_time: i64,
    start_unlock: u64,
    cliff_unlock: u64,
) -> Result<()> {
    // Check: the deposit amount is not zero.
    if deposited_amount == 0 {
        return Err(ErrorCode::InvalidDepositAmount.into());
    }

    // Check: the start time is not zero.
    if start_time == 0 {
        return Err(ErrorCode::StartTimeZero.into());
    }

    // Since a cliff time of zero means there is no cliff, the following checks are performed only if it's not zero.
    if cliff_time > 0 {
        // Check: the start time is strictly less than the cliff time.
        if start_time >= cliff_time {
            return Err(ErrorCode::StartTimeNotLessThanCliffTime.into());
        }

        // Check: the cliff time is strictly less than the end time.
        if cliff_time >= end_time {
            return Err(ErrorCode::CliffTimeNotLessThanEndTime.into());
        }
    }
    // Check: the cliff unlock amount is zero when the cliff time is zero.
    else if cliff_unlock > 0 {
        return Err(ErrorCode::CliffTimeZeroUnlockAmountNotZero.into());
    }

    // Check: the start time is strictly less than the end time.
    if start_time >= end_time {
        return Err(ErrorCode::StartTimeNotLessThanEndTime.into());
    }

    // Check: the sum of the start and cliff unlock amounts is not greater than the deposit amount.
    if start_unlock + cliff_unlock > deposited_amount {
        return Err(ErrorCode::UnlockAmountsSumTooHigh.into());
    }

    Ok(())
}

// Validate the renounce
pub fn check_renounce(is_cancelable: bool) -> Result<()> {
    // Check: the stream is cancelable.
    if !is_cancelable {
        return Err(ErrorCode::StreamAlreadyNonCancelable.into());
    }

    Ok(())
}

// Validate the withdraw
pub fn check_withdraw(amount: u64, withdrawable_amount: u64) -> Result<()> {
    // Check: the withdraw amount is not zero.
    if amount == 0 {
        return Err(ErrorCode::WithdrawAmountZero.into());
    }

    // Check: the withdraw amount is not greater than the withdrawable amount.
    if amount > withdrawable_amount {
        return Err(ErrorCode::Overdraw.into());
    }

    Ok(())
}
