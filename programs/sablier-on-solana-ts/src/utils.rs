use anchor_lang::{
    prelude::{AccountInfo, CpiContext, Result},
    solana_program::sysvar::{clock::Clock, Sysvar},
};

use anchor_spl::token_interface::{transfer_checked, TransferChecked};

use crate::{ErrorCode, Stream};

pub fn get_streamed_amount(stream: &Stream) -> u64 {
    let current_time = Clock::get().unwrap().unix_timestamp;

    if stream.cliff_time > current_time || stream.start_time > current_time {
        return 0; // No assets have been streamed yet
    }

    if stream.end_time < current_time {
        return stream.amounts.deposited; // All assets have been streamed
    }

    // Calculate the streamed amount
    let elapsed_time = current_time - stream.start_time;
    let total_duration = stream.end_time - stream.start_time;
    (stream.amounts.deposited as u128 * elapsed_time as u128 / total_duration as u128) as u64
}

pub fn get_withdrawable_amount(stream: &Stream) -> u64 {
    get_streamed_amount(stream) - stream.amounts.withdrawn
}

pub fn internal_withdraw<'info>(
    stream: &mut Stream,
    recipient_ata: AccountInfo<'info>,
    program_ata: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    mint_decimals: u8,
    token_program: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    // Assert that the withdrawn amount is not zero
    if amount == 0 {
        return Err(ErrorCode::WithdrawalAmountCannotBeZero.into());
    }

    // Calculate the withdrawable amount
    let withdrawable_amount = get_withdrawable_amount(stream);

    // Assert that the withdrawable amount is not too big
    if amount > withdrawable_amount {
        return Err(ErrorCode::InvalidWithdrawalAmount.into());
    }

    // Transfer the withdrawable SPL tokens to the recipient
    // Prepare the transfer instruction
    let transfer_ix = TransferChecked {
        from: program_ata.clone(),
        mint,
        to: recipient_ata,
        authority: program_ata,
    };

    // Execute the transfer
    let cpi_ctx = CpiContext::new(token_program, transfer_ix);
    transfer_checked(cpi_ctx, withdrawable_amount, mint_decimals)?;

    // Update the Stream's withdrawn amount
    let stream_amounts = &mut stream.amounts;
    stream_amounts.withdrawn += withdrawable_amount;

    // Mark the Stream as non-cancellable if it has been depleted
    //
    // Note: the `>=` operator is used as as extra safety measure for the case when the withdrawn amount is bigger than expected, for one reason or the other
    if stream_amounts.withdrawn >= stream_amounts.deposited - stream_amounts.refunded {
        stream.is_cancelable = false;
    }

    Ok(())
}
