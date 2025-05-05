use anchor_lang::prelude::*;

use crate::utils::errors::ErrorCode;

pub fn check_create_campaign(expiration_time: i64) -> Result<()> {
    // Check: the expiration date is strictly in the future.
    if expiration_time <= Clock::get()?.unix_timestamp {
        return Err(ErrorCode::ExpirationTimeNotInTheFuture.into());
    }

    Ok(())
}

pub fn check_clawback(clawback_amount: u64, campaign_ata_amount: u64) -> Result<()> {
    // Check: the clawback amount is not zero.
    if clawback_amount == 0 {
        return Err(ErrorCode::CantClawbackZeroAmount.into());
    }

    // Check: the clawback amount is less than or equal to the campaign ATA amount.
    if clawback_amount > campaign_ata_amount {
        return Err(ErrorCode::CantClawbackMoreThanRemaining.into());
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
