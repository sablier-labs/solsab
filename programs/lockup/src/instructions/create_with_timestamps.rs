use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::Metadata,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{lockup::*, nft_collection_data::NftCollectionData, treasury::Treasury},
    utils::{
        constants::*, events::CreateLockupLinearStream, nft, transfer_helper::transfer_tokens,
        validations::check_create,
    },
};

#[derive(Accounts)]
pub struct CreateWithTimestamps<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(mint::token_program = asset_token_program)]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = sender,
        associated_token::token_program = asset_token_program
    )]
    pub sender_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: The recipient may be any account
    pub recipient: UncheckedAccount<'info>,

    #[account(
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    #[account(
        init_if_needed, // Dev: `init_if_needed` is used to allow for a smooth Tx sequencing in case of a concurrency (i.e. multiple streams being created at the same time)
        payer = sender,
        associated_token::mint = asset_mint,
        associated_token::authority = treasury,
        associated_token::token_program = asset_token_program
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [NFT_COLLECTION_DATA_SEED],
        bump = nft_collection_data.bump
    )]
    pub nft_collection_data: Box<Account<'info, NftCollectionData>>,

    #[account(
        mut,
        seeds = [NFT_COLLECTION_MINT_SEED],
        bump,
    )]
    pub nft_collection_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [METADATA_SEED,
                 token_metadata_program.key().as_ref(),
                 nft_collection_mint.key().as_ref()],
        seeds::program = token_metadata_program.key(),
        bump,
    )]
    /// CHECK: This account will only be touched by the Metaplex program
    pub nft_collection_metadata: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [METADATA_SEED,
                 token_metadata_program.key().as_ref(),
                 nft_collection_mint.key().as_ref(),
                 EDITION_SEED],
        seeds::program = token_metadata_program.key(),
        bump,
    )]
    /// CHECK: This account will only be touched by the Metaplex program
    pub nft_collection_master_edition: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = sender,
        seeds = [STREAM_NFT_MINT_SEED,
                 nft_collection_data.total_supply.to_le_bytes().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = nft_collection_mint, // TODO: make Treasury the authority, instead?
        mint::freeze_authority = nft_collection_mint,
        mint::token_program = nft_token_program,
    )]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = sender,
        space = ANCHOR_DISCRIMINATOR_SIZE + StreamData::INIT_SPACE,
        seeds = [STREAM_DATA_SEED, stream_nft_mint.key().as_ref()],
        bump
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    #[account(
        init,
        payer = sender,
        associated_token::mint = stream_nft_mint,
        associated_token::authority = recipient,
        associated_token::token_program = nft_token_program,
    )]
    pub recipients_stream_nft_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [METADATA_SEED,
                 token_metadata_program.key().as_ref(),
                 stream_nft_mint.key().as_ref()],
        seeds::program = token_metadata_program.key(),
        bump,
    )]
    /// CHECK: This account will be initialized by the Metaplex program
    pub stream_nft_metadata: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [METADATA_SEED,
                 token_metadata_program.key().as_ref(),
                 stream_nft_mint.key().as_ref(),
                 EDITION_SEED],
        seeds::program = token_metadata_program.key(),
        bump,
    )]
    /// CHECK: This account will be initialized by the Metaplex program
    pub stream_nft_master_edition: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub asset_token_program: Interface<'info, TokenInterface>,
    pub nft_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<CreateWithTimestamps>,
    start_time: i64,
    start_unlock: u64,
    cliff_time: i64,
    cliff_unlock: u64,
    end_time: i64,
    deposited_amount: u64,
    is_cancelable: bool,
) -> Result<()> {
    // Set the bump for the stream data account.
    ctx.accounts.stream_data.bump = ctx.bumps.stream_data;

    let sender = &ctx.accounts.sender;
    let sender_ata = &ctx.accounts.sender_ata;
    let asset_mint = &ctx.accounts.asset_mint;

    // Validate parameters
    check_create(deposited_amount, start_time, cliff_time, end_time, start_unlock, cliff_unlock)?;

    let bump = ctx.accounts.stream_data.bump;
    let stream_id = ctx.accounts.nft_collection_data.total_supply;

    // Effect: create the stream data.
    ctx.accounts.stream_data.create(
        stream_id,
        sender.key(),
        asset_mint.key(),
        start_time,
        cliff_time,
        end_time,
        start_unlock,
        cliff_unlock,
        deposited_amount,
        is_cancelable,
        bump,
    )?;

    // Effect: mint the NFT to the recipient.
    nft::create_stream(
        &ctx.accounts.stream_nft_mint,
        &ctx.accounts.nft_collection_mint,
        &ctx.accounts.stream_nft_metadata,
        &ctx.accounts.stream_nft_master_edition,
        &ctx.accounts.nft_collection_metadata,
        &ctx.accounts.nft_collection_master_edition,
        &ctx.accounts.recipients_stream_nft_ata,
        &ctx.accounts.sender,
        &ctx.accounts.token_metadata_program,
        &ctx.accounts.nft_token_program,
        &ctx.accounts.system_program,
        &ctx.accounts.rent,
        stream_id,
        ctx.bumps.nft_collection_mint,
    )?;

    // Effect: increment the total supply of the NFT collection. Safe math operation, as it would take many years to
    // overflow 2^64.
    ctx.accounts.nft_collection_data.total_supply += 1;

    // Interaction: transfer tokens from the sender's ATA to the Treasury ATA.
    transfer_tokens(
        sender_ata.to_account_info(),
        ctx.accounts.treasury_ata.to_account_info(),
        sender.to_account_info(),
        asset_mint.to_account_info(),
        ctx.accounts.asset_token_program.to_account_info(),
        deposited_amount,
        asset_mint.decimals,
        &[],
    )?;

    // Log the newly created stream.
    emit!(CreateLockupLinearStream { stream_id, recipient: ctx.accounts.recipient.key() });

    Ok(())
}
