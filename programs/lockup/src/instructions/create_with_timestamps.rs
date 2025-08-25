use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::Metadata,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{lockup::*, nft_collection_data::NftCollectionData},
    utils::{
        constants::{seeds::*, ANCHOR_DISCRIMINATOR_SIZE},
        events::CreateLockupLinearStream,
        nft,
        transfer_helper::transfer_tokens,
        validations::check_create,
    },
};

#[derive(Accounts)]
#[instruction(salt: u128)]
pub struct CreateWithTimestamps<'info> {
    // -------------------------------------------------------------------------- //
    //                                USER ACCOUNTS                               //
    // -------------------------------------------------------------------------- //
    /// Write account: the creator and funder of the stream.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Write account: the creator's ATA for the deposit token.
    #[account(
      mut,
      associated_token::mint = deposit_token_mint,
      associated_token::authority = creator,
      associated_token::token_program = deposit_token_program
    )]
    pub creator_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Read account: the recipient of the stream.
    /// CHECK: The recipient may be any account
    pub recipient: UncheckedAccount<'info>,

    /// Read account: the sender of the stream.
    /// CHECK: The sender may be any account
    pub sender: UncheckedAccount<'info>,

    // -------------------------------------------------------------------------- //
    //                         STREAM COLLECTION ACCOUNTS                         //
    // -------------------------------------------------------------------------- //
    /// Write account: the NFT collection data storing the total supply.
    #[account(
      mut,
      seeds = [NFT_COLLECTION_DATA],
      bump = nft_collection_data.bump
    )]
    pub nft_collection_data: Box<Account<'info, NftCollectionData>>,

    /// Write account: the master edition account for the NFT collection.
    #[account(
      seeds = [
        METADATA,
        token_metadata_program.key().as_ref(),
        nft_collection_mint.key().as_ref(),
        EDITION,
      ],
      seeds::program = token_metadata_program.key(),
      bump,
    )]
    /// CHECK: This account will only be touched by the Metaplex program
    pub nft_collection_master_edition: UncheckedAccount<'info>,

    /// Write account: the metadata account for the NFT collection.
    #[account(
      mut,
      seeds = [
        METADATA,
        token_metadata_program.key().as_ref(),
        nft_collection_mint.key().as_ref(),
      ],
      seeds::program = token_metadata_program.key(),
      bump,
    )]
    /// CHECK: This account will only be touched by the Metaplex program
    pub nft_collection_metadata: UncheckedAccount<'info>,

    /// Read account: the mint account for the NFT collection.
    #[account(
      seeds = [NFT_COLLECTION_MINT],
      bump,
    )]
    pub nft_collection_mint: Box<InterfaceAccount<'info, Mint>>,

    // -------------------------------------------------------------------------- //
    //                               STREAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Read account: the mint account for the deposit token.
    #[account(mint::token_program = deposit_token_program)]
    pub deposit_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Create account: the mint account for the stream NFT.
    #[account(
      init,
      payer = creator,
      seeds = [
        STREAM_NFT_MINT,
        sender.key().as_ref(),
        salt.to_le_bytes().as_ref(),
      ],
      bump,
      mint::decimals = 0,
      mint::authority = nft_collection_mint,
      mint::freeze_authority = nft_collection_mint,
      mint::token_program = nft_token_program,
    )]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Create account: the ATA for the stream NFT owned by the recipient.
    #[account(
      init,
      payer = creator,
      associated_token::mint = stream_nft_mint,
      associated_token::authority = recipient,
      associated_token::token_program = nft_token_program,
    )]
    pub recipient_stream_nft_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Create account: the account that will store the stream data.
    #[account(
      init,
      payer = creator,
      space = ANCHOR_DISCRIMINATOR_SIZE + StreamData::INIT_SPACE,
      seeds = [STREAM_DATA, stream_nft_mint.key().as_ref()],
      bump
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    /// Create account: the ATA for deposit tokens owned by stream data account.
    #[account(
      init,
      payer = creator,
      associated_token::mint = deposit_token_mint,
      associated_token::authority = stream_data,
      associated_token::token_program = deposit_token_program
    )]
    pub stream_data_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Create if needed account: the master edition account for the stream NFT.
    #[account(
      mut,
      seeds = [
        METADATA,
        token_metadata_program.key().as_ref(),
        stream_nft_mint.key().as_ref(), EDITION
      ],
      seeds::program = token_metadata_program.key(),
      bump,
    )]
    /// CHECK: This account will be initialized by the Metaplex program
    pub stream_nft_master_edition: UncheckedAccount<'info>,

    /// Create if needed account: the metadata account for the stream NFT.
    #[account(
      mut,
      seeds = [
        METADATA,
        token_metadata_program.key().as_ref(),
        stream_nft_mint.key().as_ref()
      ],
      seeds::program = token_metadata_program.key(),
      bump,
    )]
    /// CHECK: This account will be initialized by the Metaplex program
    pub stream_nft_metadata: UncheckedAccount<'info>,

    // -------------------------------------------------------------------------- //
    //                              PROGRAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the Associated Token program.
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Program account: the Token program of the deposit token.
    pub deposit_token_program: Interface<'info, TokenInterface>,

    /// Program account: the Token program of the stream NFT.
    pub nft_token_program: Interface<'info, TokenInterface>,

    /// Program account: the Token Metadata program.
    pub token_metadata_program: Program<'info, Metadata>,

    // -------------------------------------------------------------------------- //
    //                               SYSTEM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the System program.
    pub system_program: Program<'info, System>,

    /// Sysvar account: Instructions.
    /// CHECK: this account is used exclusively by the Metaplex program
    pub sysvar_instructions: UncheckedAccount<'info>,
}

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
    let creator = &ctx.accounts.creator;
    let creator_ata = &ctx.accounts.creator_ata;

    // Validate parameters
    check_create(deposit_amount, start_time, cliff_time, end_time, start_unlock_amount, cliff_unlock_amount)?;

    // Effect: create the stream data.
    ctx.accounts.stream_data.create(
        deposit_token_mint.key(),
        ctx.bumps.stream_data,
        cliff_time,
        cliff_unlock_amount,
        deposit_amount,
        end_time,
        salt,
        is_cancelable,
        ctx.accounts.sender.key(),
        start_time,
        start_unlock_amount,
    )?;

    // Effect: mint the NFT to the recipient.
    nft::create_stream(
        &ctx.accounts.stream_nft_mint,
        &ctx.accounts.nft_collection_mint,
        &ctx.accounts.stream_nft_metadata,
        &ctx.accounts.stream_nft_master_edition,
        &ctx.accounts.nft_collection_metadata,
        &ctx.accounts.nft_collection_master_edition,
        &ctx.accounts.recipient,
        &ctx.accounts.recipient_stream_nft_ata,
        creator,
        &ctx.accounts.token_metadata_program,
        &ctx.accounts.nft_token_program,
        &ctx.accounts.associated_token_program,
        &ctx.accounts.system_program,
        &ctx.accounts.sysvar_instructions,
        ctx.bumps.nft_collection_mint,
    )?;

    // Effect: increment the total supply of the NFT collection.
    ctx.accounts.nft_collection_data.create()?;

    // Interaction: transfer tokens from the sender’s ATA to the StreamData ATA.
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

    // Log the newly created stream.
    emit!(CreateLockupLinearStream {
        salt,
        deposit_token_decimals: deposit_token_mint.decimals,
        deposit_token_mint: ctx.accounts.deposit_token_mint.key(),
        recipient: ctx.accounts.recipient.key(),
        stream_data: ctx.accounts.stream_data.key(),
        stream_nft_mint: ctx.accounts.stream_nft_mint.key()
    });

    Ok(())
}
