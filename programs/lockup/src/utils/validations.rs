use anchor_lang::prelude::*;

use crate::{
    state::lockup::Tranche,
    utils::{constants::MAX_TRANCHES, errors::ErrorCode},
};

/// Validate the cancellation of a stream.
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

/// Validate the collection of fees.
pub fn check_collect_fees(collectible_amount: u64) -> Result<()> {
    // Check: the collectable amount is not zero.
    if collectible_amount == 0 {
        return Err(ErrorCode::CantCollectZeroFees.into());
    }

    Ok(())
}

/// Validate the parameters for creating a linear stream.
pub fn check_create_linear(
    deposit_amount: u64,
    start_time: u64,
    cliff_time: u64,
    end_time: u64,
    start_unlock_amount: u64,
    cliff_unlock_amount: u64,
) -> Result<()> {
    // Check: the deposit amount is not zero.
    if deposit_amount == 0 {
        return Err(ErrorCode::DepositAmountZero.into());
    }

    // Check: the start time is not zero.
    if start_time == 0 {
        return Err(ErrorCode::StartTimeZero.into());
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
    else if cliff_unlock_amount > 0 {
        return Err(ErrorCode::CliffTimeZeroUnlockAmountNotZero.into());
    }

    // Check: the sum of the start and cliff unlock amounts is not greater than the deposit amount.
    let total_unlock_amount =
        start_unlock_amount.checked_add(cliff_unlock_amount).ok_or(ErrorCode::UnlockAmountsSumTooHigh)?;
    if total_unlock_amount > deposit_amount {
        return Err(ErrorCode::UnlockAmountsSumTooHigh.into());
    }

    Ok(())
}

/// Validate the parameters for creating a tranched stream.
pub fn check_create_tranched(deposit_amount: u64, start_time: u64, tranches: &[Tranche]) -> Result<()> {
    // Check: the deposit amount is not zero.
    if deposit_amount == 0 {
        return Err(ErrorCode::DepositAmountZero.into());
    }

    // Check: the start time is not zero.
    if start_time == 0 {
        return Err(ErrorCode::StartTimeZero.into());
    }

    // Check: the tranches array is not empty.
    if tranches.is_empty() {
        return Err(ErrorCode::TranchesEmpty.into());
    }

    // Check: tranches count doesn't exceed maximum.
    if tranches.len() > MAX_TRANCHES {
        return Err(ErrorCode::TooManyTranches.into());
    }

    // Check: start time is strictly less than first tranche timestamp.
    if start_time >= tranches[0].timestamp {
        return Err(ErrorCode::StartTimeNotLessThanFirstTranche.into());
    }

    // Check: timestamps strictly ascending and amounts > 0.
    let mut prev_timestamp = 0u64;
    let mut sum = 0u64;
    for tranche in tranches {
        // Check: timestamp is strictly greater than previous.
        if prev_timestamp >= tranche.timestamp {
            return Err(ErrorCode::TranchesNotSorted.into());
        }

        // Check: tranche amount is not zero.
        if tranche.amount == 0 {
            return Err(ErrorCode::TrancheAmountZero.into());
        }

        // Calculate the sum of the tranche amounts, checking for overflow.
        sum = sum.checked_add(tranche.amount).ok_or(ErrorCode::TrancheAmountsSumOverflow)?;

        prev_timestamp = tranche.timestamp;
    }

    // Check: sum equals deposit amount.
    if sum != deposit_amount {
        return Err(ErrorCode::TrancheAndDepositAmountsMismatch.into());
    }

    Ok(())
}

/// Validate the renouncement of a stream.
pub fn check_renounce(is_cancelable: bool, deposited_amount: u64, streamed_amount: u64) -> Result<()> {
    // Check: the stream is cancelable.
    if !is_cancelable || streamed_amount >= deposited_amount {
        return Err(ErrorCode::StreamAlreadyNonCancelable.into());
    }

    Ok(())
}

/// Validate a withdrawal from a stream.
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
