use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
        set_and_verify_sized_collection_item, CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
        SetAndVerifySizedCollectionItem,
    },
    token_interface::{mint_to, transfer_checked, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    state::{lockup::*, nft_collection_data::NftCollectionData, treasury::Treasury},
    utils::{constants::*, errors::ErrorCode, events::StreamCreation},
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
        mut,
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
        mut,
        seeds = [STREAM_NFT_MINT_SEED,
                 nft_collection_data.total_supply.to_le_bytes().as_ref()],
        bump,
    )]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [STREAM_DATA_SEED, stream_nft_mint.key().as_ref()],
        bump = stream_data.bump,
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
    let sender = &ctx.accounts.sender;
    let sender_ata = &ctx.accounts.sender_ata;
    let asset_mint = &ctx.accounts.asset_mint;
    let nft_collection_mint = &ctx.accounts.nft_collection_mint;
    let stream_nft_mint = &ctx.accounts.stream_nft_mint;
    let stream_nft_metadata = &ctx.accounts.stream_nft_metadata;
    let token_metadata_program = &ctx.accounts.token_metadata_program;
    let nft_token_program = &ctx.accounts.nft_token_program;
    let system_program = &ctx.accounts.system_program;
    let rent = &ctx.accounts.rent;

    // Assert that the deposited amount is not zero
    if deposited_amount == 0 {
        return Err(ErrorCode::InvalidDepositAmount.into());
    }

    if cliff_time > 0 {
        // Assert that the cliff time is strictly between the start and end times
        if cliff_time <= start_time || cliff_time >= end_time {
            return Err(ErrorCode::InvalidCliffTime.into());
        }
    } else if cliff_unlock == 0 {
        return Err(ErrorCode::InvalidCliffUnlockAmount.into());
    }

    if start_unlock + cliff_unlock > deposited_amount {
        return Err(ErrorCode::DepositAmountLessThanUnlockAmounts.into());
    }

    // Prepare the instruction to transfer the SPL tokens to the Treasury's ATA
    let transfer_ix = TransferChecked {
        from: sender_ata.to_account_info(),
        mint: asset_mint.to_account_info(),
        to: ctx.accounts.treasury_ata.to_account_info(),
        authority: sender.to_account_info(),
    };

    // Execute the transfer
    let cpi_ctx = CpiContext::new(ctx.accounts.asset_token_program.to_account_info(), transfer_ix);
    transfer_checked(cpi_ctx, deposited_amount, asset_mint.decimals)?;

    let stream_id = ctx.accounts.nft_collection_data.total_supply;
    let stream_nft_name = NFT_NAME.to_owned() + stream_id.to_string().as_str();

    let nft_collection_mint_signer_seeds: &[&[&[u8]]] =
        &[&[NFT_COLLECTION_MINT_SEED, &[ctx.bumps.nft_collection_mint]]];

    // Mint Stream NFT Token
    mint_to(
        CpiContext::new_with_signer(
            nft_token_program.to_account_info(),
            MintTo {
                mint: stream_nft_mint.to_account_info(),
                to: ctx.accounts.recipients_stream_nft_ata.to_account_info(),
                authority: nft_collection_mint.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        1,
    )?;

    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: stream_nft_metadata.to_account_info(),
                mint: stream_nft_mint.to_account_info(),
                mint_authority: nft_collection_mint.to_account_info(),
                update_authority: nft_collection_mint.to_account_info(),
                payer: sender.to_account_info(),
                system_program: system_program.to_account_info(),
                rent: rent.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        DataV2 {
            name: stream_nft_name,
            symbol: NFT_SYMBOL.to_string(),
            uri: NFT_METADATA_URI.to_string(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        true,
        true,
        None,
    )?;

    create_master_edition_v3(
        CpiContext::new_with_signer(
            token_metadata_program.to_account_info(),
            CreateMasterEditionV3 {
                payer: sender.to_account_info(),
                mint: stream_nft_mint.to_account_info(),
                edition: ctx.accounts.stream_nft_master_edition.to_account_info(),
                mint_authority: nft_collection_mint.to_account_info(),
                update_authority: nft_collection_mint.to_account_info(),
                metadata: stream_nft_metadata.to_account_info(),
                token_program: nft_token_program.to_account_info(),
                system_program: system_program.to_account_info(),
                rent: rent.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        Some(0),
    )?;

    // verify the NFT as part of the collection
    set_and_verify_sized_collection_item(
        CpiContext::new_with_signer(
            token_metadata_program.to_account_info(),
            SetAndVerifySizedCollectionItem {
                metadata: stream_nft_metadata.to_account_info(),
                collection_authority: nft_collection_mint.to_account_info(),
                payer: sender.to_account_info(),
                update_authority: nft_collection_mint.to_account_info(),
                collection_mint: nft_collection_mint.to_account_info(),
                collection_metadata: ctx.accounts.nft_collection_metadata.to_account_info(),
                collection_master_edition: ctx.accounts.nft_collection_master_edition.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        None,
    )?;

    // Initialize the fields of the newly created StreamData account

    let milestones: Milestones = Milestones { start_time, cliff_time, end_time };
    let amounts = Amounts { deposited: deposited_amount, start_unlock, cliff_unlock, withdrawn: 0, refunded: 0 };

    **ctx.accounts.stream_data = StreamData {
        id: stream_id,
        sender: sender.key(),
        asset_mint: asset_mint.key(),
        amounts,
        milestones,
        is_cancelable,
        was_canceled: false,
        bump: ctx.accounts.stream_data.bump,
    };

    // Increment the Total Supply of the NFT Collection
    let total_supply = &mut ctx.accounts.nft_collection_data.total_supply;
    *total_supply = total_supply.checked_add(1).ok_or(ErrorCode::NftCollectionTotalSupplyOverflow)?;

    // Emit an event indicating the creation of the Stream
    msg!("{} created a Stream id {} and token {}", sender.key(), stream_id, asset_mint.key());
    emit!(StreamCreation { stream_id, recipient: ctx.accounts.recipient.key() });

    Ok(())
}
