use anchor_lang::prelude::*;
use mpl_core::instructions::CreateV2CpiBuilder;

use crate::{
    instructions::create_with_timestamps_ll::CreateWithTimestamps,
    state::lockup::Tranche,
    utils::{
        constants::{
            nft::{LT_NFT_METADATA_URI, LT_NFT_NAME_PREFIX},
            seeds::*,
        },
        events::{CreateLockupStream, CreateStreamModel},
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
    let funder = &ctx.accounts.funder;
    let funder_ata = &ctx.accounts.funder_ata;
    let recipient = &ctx.accounts.recipient;
    let sender_key = &ctx.accounts.sender.key();
    let stream_nft = &ctx.accounts.stream_nft;

    // Validate the parameters and calculate the deposit amount from the tranches.
    let deposit_amount = check_create_tranched(start_time, &tranches)?;

    // Effect: create the tranched stream data.
    ctx.accounts.stream_data.create_tranched(
        deposit_token_mint.key(),
        ctx.bumps.stream_data,
        deposit_amount,
        salt,
        is_cancelable,
        *sender_key,
        start_time,
        tranches.clone(),
    )?;

    // Effect: create the MPL Core asset representing the stream NFT.
    // Note: the stream NFT is automatically added to the stream NFT collection.

    // Construct the Stream NFT name using the following format:
    // "Sablier LT Stream #[first 5 chars of asset key]...[last 5 chars of asset key]"
    let stream_nft_key = stream_nft.key().to_string();
    let stream_nft_name =
        format!("{LT_NFT_NAME_PREFIX}{}...{}", &stream_nft_key[..5], &stream_nft_key[stream_nft_key.len() - 5..]);

    let stream_nft_signer_seeds: &[&[u8]] =
        &[STREAM_NFT, sender_key.as_ref(), &salt.to_le_bytes(), &[ctx.bumps.stream_nft]];
    let collection_authority_signer_seeds: &[&[u8]] = &[TREASURY, &[ctx.bumps.treasury]];

    CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&stream_nft.to_account_info())
        .collection(Some(&ctx.accounts.stream_nft_collection.to_account_info()))
        .authority(Some(&ctx.accounts.treasury.to_account_info()))
        .owner(Some(&recipient.to_account_info()))
        .payer(&funder.to_account_info())
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(stream_nft_name)
        .uri(LT_NFT_METADATA_URI.to_string())
        .invoke_signed(&[stream_nft_signer_seeds, collection_authority_signer_seeds])?;

    // Interaction: transfer tokens from the funder's ATA to the StreamData ATA.
    transfer_tokens(
        funder_ata.to_account_info(),
        ctx.accounts.stream_data_ata.to_account_info(),
        funder.to_account_info(),
        deposit_token_mint.to_account_info(),
        ctx.accounts.deposit_token_program.to_account_info(),
        deposit_amount,
        deposit_token_mint.decimals,
        &[],
    )?;

    // Log the newly created tranched stream.
    emit!(CreateLockupStream {
        deposit_token_decimals: deposit_token_mint.decimals,
        deposit_token_mint: deposit_token_mint.key(),
        model: CreateStreamModel::Tranched {
            tranches
        },
        recipient: recipient.key(),
        salt,
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft: stream_nft.key(),
    });

    Ok(())
}
