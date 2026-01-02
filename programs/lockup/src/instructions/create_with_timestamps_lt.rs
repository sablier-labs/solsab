//! Handler for creating tranched streams with absolute timestamps.
//!
//! Reuses the `CreateWithTimestamps` account context from the linear stream handler,
//! but accepts tranches instead of start/cliff/end timestamps.

use anchor_lang::prelude::*;

use crate::{
    instructions::create_with_timestamps::CreateWithTimestamps,
    state::lockup::Tranche,
    utils::{
        errors::ErrorCode, events::CreateLockupTranchedStream, nft, transfer_helper::transfer_tokens,
        validations::check_create_tranched,
    },
};

/// Handler for creating a tranched stream with absolute timestamps.
///
/// # Parameters
/// * `salt` - Unique salt for PDA derivation
/// * `start_time` - Stream start time
/// * `tranches` - Vec of tranches with amounts and timestamps in ascending order
/// * `is_cancelable` - Whether sender can cancel the stream
///
/// # Notes
/// - The deposit amount is calculated as the sum of all tranche amounts.
/// - Tranches must have timestamps in strictly ascending order.
/// - Start time must be strictly less than the first tranche timestamp.
#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<CreateWithTimestamps>,
    salt: u128,
    start_time: u64,
    tranches: Vec<Tranche>,
    is_cancelable: bool,
) -> Result<()> {
    let deposit_token_mint = &ctx.accounts.deposit_token_mint;
    let creator = &ctx.accounts.creator;
    let creator_ata = &ctx.accounts.creator_ata;

    // Calculate the deposit amount from the tranches, checking for overflow.
    let deposit_amount: u64 = tranches
        .iter()
        .try_fold(0u64, |acc, t| acc.checked_add(t.amount))
        .ok_or(ErrorCode::TrancheAmountsSumOverflow)?;

    // Validate the parameters of the tranched stream.
    check_create_tranched(deposit_amount, start_time, &tranches)?;

    // Effect: create the tranched stream data.
    ctx.accounts.stream_data.create_tranched(
        deposit_token_mint.key(),
        ctx.bumps.stream_data,
        deposit_amount,
        salt,
        is_cancelable,
        ctx.accounts.sender.key(),
        start_time,
        tranches.clone(),
    )?;

    // Effect: mint the NFT to the recipient.
    nft::create_stream(
        &ctx.accounts.stream_nft_mint,
        &ctx.accounts.nft_collection_mint,
        &ctx.accounts.stream_nft_metadata,
        &ctx.accounts.stream_nft_master_edition,
        &ctx.accounts.nft_collection_metadata,
        &ctx.accounts.nft_collection_master_edition,
        &ctx.accounts.recipient_stream_nft_ata,
        creator,
        &ctx.accounts.token_metadata_program,
        &ctx.accounts.nft_token_program,
        &ctx.accounts.system_program,
        &ctx.accounts.rent,
        ctx.bumps.nft_collection_mint,
    )?;

    // Effect: increment the total supply of the NFT collection.
    ctx.accounts.nft_collection_data.create()?;

    // Interaction: transfer tokens from the creator's ATA to the StreamData ATA.
    transfer_tokens(
        creator_ata.to_account_info(),
        ctx.accounts.stream_data_ata.to_account_info(),
        creator.to_account_info(),
        deposit_token_mint.to_account_info(),
        ctx.accounts.deposit_token_program.to_account_info(),
        deposit_amount,
        deposit_token_mint.decimals,
        &[],
    )?;

    // Log the newly created tranched stream.
    emit!(CreateLockupTranchedStream {
        salt,
        deposit_token_decimals: deposit_token_mint.decimals,
        deposit_token_mint: ctx.accounts.deposit_token_mint.key(),
        recipient: ctx.accounts.recipient.key(),
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft_mint: ctx.accounts.stream_nft_mint.key(),
        tranche_count: tranches.len() as u32,
    });

    Ok(())
}
