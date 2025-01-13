use anchor_lang::{
    prelude::{Account, AccountInfo, CpiContext, Result},
    solana_program::sysvar::{clock::Clock, Sysvar},
    ToAccountInfo,
};

use anchor_spl::token_interface::{transfer_checked, TransferChecked};

use crate::{ErrorCode, Milestones, Stream, Treasury};

pub fn get_streamed_amount(stream: &Stream) -> u64 {
    let current_time = Clock::get().unwrap().unix_timestamp;

    let milestones: &Milestones = &stream.milestones;

    if milestones.cliff_time > current_time || milestones.start_time > current_time {
        return 0; // No assets have been streamed yet
    }

    if milestones.end_time < current_time {
        return stream.amounts.deposited; // All assets have been streamed
    }

    // Calculate the streamed amount
    let elapsed_time = current_time - milestones.start_time;
    let total_duration = milestones.end_time - milestones.start_time;
    (stream.amounts.deposited as u128 * elapsed_time as u128 / total_duration as u128) as u64
}

pub fn get_withdrawable_amount(stream: &Stream) -> u64 {
    get_streamed_amount(stream) - stream.amounts.withdrawn
}

pub fn internal_withdraw<'info>(
    stream: &mut Stream,
    recipient_ata: AccountInfo<'info>,
    treasury_ata: AccountInfo<'info>,
    treasury_pda: &Account<'info, Treasury>,
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
        from: treasury_ata.clone(),
        mint,
        to: recipient_ata,
        authority: treasury_pda.to_account_info(),
    };

    // Wrap the Treasury PDA's seeds in the appropriate structure
    let signer_seeds: &[&[&[u8]]] = &[&[b"treasury", &[treasury_pda.bump]]];

    // Execute the transfer
    let cpi_ctx = CpiContext::new_with_signer(token_program, transfer_ix, signer_seeds);
    transfer_checked(cpi_ctx, amount, mint_decimals)?;

    // Update the Stream's withdrawn amount
    let stream_amounts = &mut stream.amounts;
    stream_amounts.withdrawn += amount;

    // Mark the Stream as non-cancellable if it has been depleted
    //
    // Note: the `>=` operator is used as as extra safety measure for the case when the withdrawn amount is bigger than
    // expected, for one reason or the other
    if stream_amounts.withdrawn >= stream_amounts.deposited - stream_amounts.refunded {
        stream.is_cancelable = false;
    }

    Ok(())
}
