use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3,
        mpl_token_metadata::types::{CollectionDetails, Creator, DataV2},
        set_and_verify_sized_collection_item, sign_metadata, CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
        SetAndVerifySizedCollectionItem, SignMetadata,
    },
    token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface},
};

use crate::utils::constants::{nft_constants::*, seeds::NFT_COLLECTION_MINT_SEED};

/// Creates and mints a stream NFT with collection verification
#[allow(clippy::too_many_arguments)]
pub fn create_stream<'info>(
    stream_nft_mint: &InterfaceAccount<'info, Mint>,
    nft_collection_mint: &InterfaceAccount<'info, Mint>,
    stream_nft_metadata: &UncheckedAccount<'info>,
    stream_nft_master_edition: &UncheckedAccount<'info>,
    nft_collection_metadata: &UncheckedAccount<'info>,
    nft_collection_master_edition: &UncheckedAccount<'info>,
    recipient_stream_nft_ata: &InterfaceAccount<'info, TokenAccount>,
    sender: &Signer<'info>,
    token_metadata_program: &Program<'info, Metadata>,
    nft_token_program: &Interface<'info, TokenInterface>,
    system_program: &Program<'info, System>,
    rent: &Sysvar<'info, Rent>,
    nft_collection_mint_bump: u8,
) -> Result<()> {
    // Form the Stream NFT name, which has the following format:
    // "Sablier LL Stream #[first 4 chars of mint key]..[last 4 chars of mint key]"
    // e.g., "Sablier LL Stream #2qid..m8jF"
    let mint_key: String = stream_nft_mint.key().to_string();
    let nft_name = format!("{NFT_NAME_PREFIX}{}..{}", &mint_key[..4], &mint_key[mint_key.len() - 4..]);

    // Prepare the seeds for NFT Collection Mint
    let nft_collection_mint_signer_seeds: &[&[&[u8]]] = &[&[NFT_COLLECTION_MINT_SEED, &[nft_collection_mint_bump]]];

    // Mint Stream NFT Token
    mint_to(
        CpiContext::new_with_signer(
            nft_token_program.to_account_info(),
            MintTo {
                mint: stream_nft_mint.to_account_info(),
                to: recipient_stream_nft_ata.to_account_info(),
                authority: nft_collection_mint.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        1,
    )?;

    // Create metadata
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
            name: nft_name,
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

    // Create master edition
    create_master_edition_v3(
        CpiContext::new_with_signer(
            token_metadata_program.to_account_info(),
            CreateMasterEditionV3 {
                payer: sender.to_account_info(),
                mint: stream_nft_mint.to_account_info(),
                edition: stream_nft_master_edition.to_account_info(),
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

    // Verify the NFT as part of the collection
    set_and_verify_sized_collection_item(
        CpiContext::new_with_signer(
            token_metadata_program.to_account_info(),
            SetAndVerifySizedCollectionItem {
                metadata: stream_nft_metadata.to_account_info(),
                collection_authority: nft_collection_mint.to_account_info(),
                payer: sender.to_account_info(),
                update_authority: nft_collection_mint.to_account_info(),
                collection_mint: nft_collection_mint.to_account_info(),
                collection_metadata: nft_collection_metadata.to_account_info(),
                collection_master_edition: nft_collection_master_edition.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        None,
    )?;

    Ok(())
}

/// Creates and verifies an NFT collection
#[allow(clippy::too_many_arguments)]
pub fn initialize_collection<'info>(
    nft_collection_mint: &InterfaceAccount<'info, Mint>,
    nft_collection_ata: &InterfaceAccount<'info, TokenAccount>,
    nft_collection_metadata: &UncheckedAccount<'info>,
    nft_collection_master_edition: &UncheckedAccount<'info>,
    payer: &Signer<'info>,
    token_metadata_program: &Program<'info, Metadata>,
    nft_token_program: &Interface<'info, TokenInterface>,
    system_program: &Program<'info, System>,
    rent: &Sysvar<'info, Rent>,
    nft_collection_mint_bump: u8,
) -> Result<()> {
    let nft_collection_mint_signer_seeds: &[&[&[u8]]] = &[&[NFT_COLLECTION_MINT_SEED, &[nft_collection_mint_bump]]];

    // Mint the Collection NFT
    mint_to(
        CpiContext::new_with_signer(
            nft_token_program.to_account_info(),
            MintTo {
                mint: nft_collection_mint.to_account_info(),
                to: nft_collection_ata.to_account_info(),
                authority: nft_collection_mint.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        1,
    )?;

    // Create the Metadata accounts for the Collection NFT
    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: nft_collection_metadata.to_account_info(),
                mint: nft_collection_mint.to_account_info(),
                mint_authority: nft_collection_mint.to_account_info(),
                update_authority: nft_collection_mint.to_account_info(),
                payer: payer.to_account_info(),
                system_program: system_program.to_account_info(),
                rent: rent.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        DataV2 {
            name: COLLECTION_NAME.to_string(),
            symbol: COLLECTION_SYMBOL.to_string(),
            uri: COLLECTION_METADATA_URI.to_string(),
            seller_fee_basis_points: 0,
            creators: Some(vec![Creator { address: nft_collection_mint.key(), verified: false, share: 100 }]),
            collection: None,
            uses: None,
        },
        true,
        true,
        Some(CollectionDetails::V1 { size: 0 }),
    )?;

    // Create Master edition accounts for the Collection NFT
    create_master_edition_v3(
        CpiContext::new_with_signer(
            token_metadata_program.to_account_info(),
            CreateMasterEditionV3 {
                payer: payer.to_account_info(),
                mint: nft_collection_mint.to_account_info(),
                edition: nft_collection_master_edition.to_account_info(),
                mint_authority: nft_collection_mint.to_account_info(),
                update_authority: nft_collection_mint.to_account_info(),
                metadata: nft_collection_metadata.to_account_info(),
                token_program: nft_token_program.to_account_info(),
                system_program: system_program.to_account_info(),
                rent: rent.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        Some(0),
    )?;

    // Verify the collection NFT creator
    sign_metadata(CpiContext::new_with_signer(
        token_metadata_program.to_account_info(),
        SignMetadata {
            creator: nft_collection_mint.to_account_info(),
            metadata: nft_collection_metadata.to_account_info(),
        },
        nft_collection_mint_signer_seeds,
    ))?;

    Ok(())
}
