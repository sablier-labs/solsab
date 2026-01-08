use anchor_lang::prelude::*;

use crate::{
    instructions::create_with_timestamps_ll::CreateWithTimestamps,
    state::lockup::Tranche,
    utils::{
        errors::ErrorCode,
        events::{CreateLockupStream, CreateStreamModel},
        nft,
        transfer_helper::transfer_tokens,
        validations::check_create_tranched,
    },
};

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_lockup::create_with_timestamps_lt`].
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
        ctx.accounts.creator_ata.to_account_info(),
        ctx.accounts.stream_data_ata.to_account_info(),
        creator.to_account_info(),
        deposit_token_mint.to_account_info(),
        ctx.accounts.deposit_token_program.to_account_info(),
        deposit_amount,
        deposit_token_mint.decimals,
        &[],
    )?;

    // Log the newly created tranched stream.
    emit!(CreateLockupStream {
        deposit_token_decimals: deposit_token_mint.decimals,
        deposit_token_mint: ctx.accounts.deposit_token_mint.key(),
        model: CreateStreamModel::Tranched {
            tranches
        },
        recipient: ctx.accounts.recipient.key(),
        salt,
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft_mint: ctx.accounts.stream_nft_mint.key(),
    });

    Ok(())
}
