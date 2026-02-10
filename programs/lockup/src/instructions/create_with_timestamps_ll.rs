use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use mpl_core::{accounts::BaseCollectionV1, instructions::CreateV2CpiBuilder, programs::MPL_CORE_ID};

use crate::{
    state::{lockup::*, Treasury},
    utils::{
        constants::{
            nft::{LL_NFT_METADATA_URI, LL_NFT_NAME_PREFIX},
            seeds::*,
            ANCHOR_DISCRIMINATOR_SIZE,
        },
        events::{CreateLockupStream, CreateStreamModel},
        transfer_helper::transfer_tokens,
        validations::check_create_linear,
    },
};

// -------------------------------------------------------------------------- //
//                                IX ACCOUNTS                                 //
// -------------------------------------------------------------------------- //

#[derive(Accounts)]
#[instruction(salt: u128)]
pub struct CreateWithTimestamps<'info> {
    // -------------------------------------------------------------------------- //
    //                                USER ACCOUNTS                               //
    // -------------------------------------------------------------------------- //
    /// Write account: the signer and the funder of the stream.
    #[account(mut)]
    pub funder: Signer<'info>,

    /// Write account: the funder's ATA for the deposit token.
    #[account(
      mut,
      associated_token::mint = deposit_token_mint,
      associated_token::authority = funder,
      associated_token::token_program = deposit_token_program
    )]
    pub funder_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Read account: the recipient of the stream.
    /// CHECK: The recipient may be any account
    pub recipient: UncheckedAccount<'info>,

    /// Read account: the sender of the stream.
    /// CHECK: The sender may be any account
    pub sender: UncheckedAccount<'info>,

    // -------------------------------------------------------------------------- //
    //                              SABLIER ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the treasury.
    #[account(
      seeds = [TREASURY],
      bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    // -------------------------------------------------------------------------- //
    //                         STREAM COLLECTION ACCOUNTS                         //
    // -------------------------------------------------------------------------- //
    /// Write account: the Stream NFT collection.
    #[account(
      mut,
      seeds = [STREAM_NFT_COLLECTION],
      bump
    )]
    pub stream_nft_collection: Box<Account<'info, BaseCollectionV1>>,

    // -------------------------------------------------------------------------- //
    //                               STREAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the mint account for the deposit token.
    #[account(mint::token_program = deposit_token_program)]
    pub deposit_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Create account: the account that will store the stream data.
    #[account(
      init,
      payer = funder,
      space = ANCHOR_DISCRIMINATOR_SIZE + StreamData::INIT_SPACE,
      seeds = [STREAM_DATA, stream_nft.key().as_ref()],
      bump
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    /// Create account: the ATA for deposit tokens owned by stream data account.
    #[account(
      init,
      payer = funder,
      associated_token::mint = deposit_token_mint,
      associated_token::authority = stream_data,
      associated_token::token_program = deposit_token_program
    )]
    pub stream_data_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Create account: the NFT representing the stream.
    #[account(
      mut,
      seeds = [
        STREAM_NFT,
        sender.key().as_ref(),
        salt.to_le_bytes().as_ref(),
      ],
      bump
    )]
    /// CHECK: This account will be initialized by the MPL Core program
    pub stream_nft: UncheckedAccount<'info>,

    // -------------------------------------------------------------------------- //
    //                              PROGRAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the Associated Token program.
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Program account: the Token program of the deposit token.
    pub deposit_token_program: Interface<'info, TokenInterface>,

    /// Program account: the MPL Core program.
    /// CHECK: Validated by the address constraint
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    // -------------------------------------------------------------------------- //
    //                               SYSTEM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the System program.
    pub system_program: Program<'info, System>,
}

// -------------------------------------------------------------------------- //
//                                 IX HANDLER                                 //
// -------------------------------------------------------------------------- //

/// See the documentation for [`fn@crate::sablier_lockup::create_with_timestamps_ll`].
#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<CreateWithTimestamps>,
    salt: u128,
    deposit_amount: u64,
    start_time: u64,
    cliff_time: u64,
    end_time: u64,
    start_unlock_amount: u64,
    cliff_unlock_amount: u64,
    is_cancelable: bool,
) -> Result<()> {
    let deposit_token_mint = &ctx.accounts.deposit_token_mint;
    let funder = &ctx.accounts.funder;
    let funder_ata = &ctx.accounts.funder_ata;
    let recipient = &ctx.accounts.recipient;
    let sender_key = &ctx.accounts.sender.key();
    let stream_nft = &ctx.accounts.stream_nft;

    // Validate the ix parameters.
    check_create_linear(deposit_amount, start_time, cliff_time, end_time, start_unlock_amount, cliff_unlock_amount)?;

    // Effect: create the linear stream data.
    ctx.accounts.stream_data.create_linear(
        ctx.bumps.stream_data,
        cliff_time,
        cliff_unlock_amount,
        deposit_amount,
        deposit_token_mint.key(),
        end_time,
        is_cancelable,
        stream_nft.key(),
        salt,
        *sender_key,
        start_time,
        start_unlock_amount,
    )?;

    // Effect: create the MPL Core asset representing the stream NFT.
    // Note: the stream NFT is automatically added to the stream NFT collection.

    // Construct the Stream NFT name using the following format:
    // "Sablier LL Stream #[first 5 chars of asset key]...[last 5 chars of asset key]"
    let stream_nft_key = stream_nft.key().to_string();
    let stream_nft_name =
        format!("{LL_NFT_NAME_PREFIX}{}...{}", &stream_nft_key[..5], &stream_nft_key[stream_nft_key.len() - 5..]);

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
        .uri(LL_NFT_METADATA_URI.to_string())
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

    // Log the newly created stream.
    emit!(CreateLockupStream {
        deposit_token_decimals: deposit_token_mint.decimals,
        deposit_token_mint: deposit_token_mint.key(),
        model: CreateStreamModel::Linear,
        recipient: recipient.key(),
        salt,
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft: stream_nft.key(),
    });

    Ok(())
}
