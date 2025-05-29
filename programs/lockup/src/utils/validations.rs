use anchor_lang::prelude::*;

use crate::utils::errors::ErrorCode;

pub fn check_cancel(
    is_cancelable: bool,
    is_depleted: bool,
    was_canceled: bool,
    streamed_amount: u64,
    deposited_amount: u64,
) -> Result<()> {
    // Check: the stream is neither depleted nor canceled.
    if is_depleted {
        return Err(ErrorCode::StreamDepleted.into());
    } else if was_canceled {
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

pub fn check_collect_fees(collectable_amount: u64) -> Result<()> {
    // Check: the collectable amount is not zero.
    if collectable_amount == 0 {
        return Err(ErrorCode::CantCollectZeroFees.into());
    }

    Ok(())
}

// Validate the parameters for creating a Stream
pub fn check_create(
    deposit_amount: u64,
    start_time: i64,
    cliff_time: i64,
    end_time: i64,
    start_unlock: u64,
    cliff_unlock: u64,
) -> Result<()> {
    // Check: the deposit amount is not zero.
    if deposit_amount == 0 {
        return Err(ErrorCode::DepositAmountZero.into());
    }

    // Check: the start time is a positive number.
    if start_time <= 0 {
        return Err(ErrorCode::StartTimeNotPositive.into());
    }

    // Check: the start time is strictly less than the end time.
    if start_time >= end_time {
        return Err(ErrorCode::StartTimeNotLessThanEndTime.into());
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

    // Check: the sum of the start and cliff unlock amounts is not greater than the deposit amount.
    if start_unlock + cliff_unlock > deposit_amount {
        return Err(ErrorCode::UnlockAmountsSumTooHigh.into());
    }

    Ok(())
}

// Validate the renounce
pub fn check_renounce(is_cancelable: bool, deposited_amount: u64, streamed_amount: u64) -> Result<()> {
    // Check: the stream is cancelable.
    if !is_cancelable || streamed_amount >= deposited_amount {
        return Err(ErrorCode::StreamAlreadyNonCancelable.into());
    }

    Ok(())
}

// Validate the withdraw
pub fn check_withdraw(is_depleted: bool, amount: u64, withdrawable_amount: u64) -> Result<()> {
    // Check: the stream is not depleted.
    if is_depleted {
        return Err(ErrorCode::StreamDepleted.into());
    }

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
