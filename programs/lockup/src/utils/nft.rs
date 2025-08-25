use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        mpl_token_metadata::types::{CollectionDetails, TokenStandard},
        Metadata,
    },
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use mpl_token_metadata::{
    instructions::{CreateV1CpiBuilder, MintV1CpiBuilder, VerifyCollectionV1CpiBuilder},
    types::{Collection, PrintSupply},
};

use crate::utils::constants::{nft::*, seeds::NFT_COLLECTION_MINT};

/// Creates and mints a stream NFT, adding it to the Stream NFT collection
#[allow(clippy::too_many_arguments)]
pub fn create_stream<'info>(
    stream_nft_mint: &InterfaceAccount<'info, Mint>,
    nft_collection_mint: &InterfaceAccount<'info, Mint>,
    stream_nft_metadata: &UncheckedAccount<'info>,
    stream_nft_master_edition: &UncheckedAccount<'info>,
    nft_collection_metadata: &UncheckedAccount<'info>,
    nft_collection_master_edition: &UncheckedAccount<'info>,
    recipient: &UncheckedAccount<'info>,
    recipient_stream_nft_ata: &InterfaceAccount<'info, TokenAccount>,
    creator: &Signer<'info>,
    token_metadata_program: &Program<'info, Metadata>,
    nft_token_program: &Interface<'info, TokenInterface>,
    associated_token_program: &Program<'info, AssociatedToken>,
    system_program: &Program<'info, System>,
    sysvar_instructions: &UncheckedAccount<'info>,
    nft_collection_mint_bump: u8,
) -> Result<()> {
    // Construct the Stream NFT name using the following format:
    // "Sablier LL Stream #[first 5 chars of mint key]...[last 5 chars of mint key]"
    // Example: "Sablier LL Stream #2qidf...dm8jF"
    let mint_key: String = stream_nft_mint.key().to_string();
    let nft_name = format!("{NFT_NAME_PREFIX}{}...{}", &mint_key[..5], &mint_key[mint_key.len() - 5..]);

    // Prepare the seeds for NFT Collection Mint
    let nft_collection_mint_signer_seeds: &[&[&[u8]]] = &[&[NFT_COLLECTION_MINT, &[nft_collection_mint_bump]]];

    CreateV1CpiBuilder::new(&token_metadata_program.to_account_info())
        .metadata(stream_nft_metadata)
        .master_edition(Some(stream_nft_master_edition))
        .mint(&stream_nft_mint.to_account_info(), false)
        .authority(&nft_collection_mint.to_account_info())
        .payer(&creator.to_account_info())
        .update_authority(&nft_collection_mint.to_account_info(), false)
        .system_program(&system_program.to_account_info())
        .sysvar_instructions(sysvar_instructions)
        .spl_token_program(Some(&nft_token_program.to_account_info()))
        .name(nft_name)
        .symbol(NFT_SYMBOL.to_string())
        .uri(NFT_METADATA_URI.to_string())
        .seller_fee_basis_points(0)
        .primary_sale_happened(true)
        .is_mutable(true)
        .token_standard(TokenStandard::NonFungible)
        .print_supply(PrintSupply::Zero)
        .collection(Collection {
            verified: false,
            key: nft_collection_mint.key(),
        })
        .decimals(0)
        .invoke_signed(nft_collection_mint_signer_seeds)?;

    MintV1CpiBuilder::new(&token_metadata_program.to_account_info())
        .token(&recipient_stream_nft_ata.to_account_info())
        .token_owner(Some(recipient))
        .metadata(stream_nft_metadata)
        .master_edition(Some(stream_nft_master_edition))
        .mint(&stream_nft_mint.to_account_info())
        .payer(&creator.to_account_info())
        .authority(&nft_collection_mint.to_account_info())
        .system_program(&system_program.to_account_info())
        .sysvar_instructions(sysvar_instructions)
        .spl_token_program(&nft_token_program.to_account_info())
        .spl_ata_program(&associated_token_program.to_account_info())
        .amount(1)
        .invoke_signed(nft_collection_mint_signer_seeds)?;

    VerifyCollectionV1CpiBuilder::new(token_metadata_program)
        .authority(&nft_collection_mint.to_account_info())
        .metadata(stream_nft_metadata)
        .collection_mint(&nft_collection_mint.to_account_info())
        .collection_metadata(Some(nft_collection_metadata))
        .collection_master_edition(Some(nft_collection_master_edition))
        .system_program(&system_program.to_account_info())
        .sysvar_instructions(sysvar_instructions)
        .invoke_signed(nft_collection_mint_signer_seeds)?;

    Ok(())
}

/// Creates and verifies an NFT collection
#[allow(clippy::too_many_arguments)]
pub fn initialize_collection<'info>(
    nft_collection_mint: &InterfaceAccount<'info, Mint>,
    nft_collection_ata: &InterfaceAccount<'info, TokenAccount>,
    nft_collection_ata_authority: &AccountInfo<'info>,
    nft_collection_metadata: &UncheckedAccount<'info>,
    nft_collection_master_edition: &UncheckedAccount<'info>,
    payer: &Signer<'info>,
    token_metadata_program: &Program<'info, Metadata>,
    nft_token_program: &Interface<'info, TokenInterface>,
    associated_token_program: &Program<'info, AssociatedToken>,
    system_program: &Program<'info, System>,
    sysvar_instructions: &AccountInfo<'info>,
    nft_collection_mint_bump: u8,
) -> Result<()> {
    let nft_collection_mint_signer_seeds: &[&[&[u8]]] = &[&[NFT_COLLECTION_MINT, &[nft_collection_mint_bump]]];

    CreateV1CpiBuilder::new(token_metadata_program)
        .metadata(nft_collection_metadata)
        .mint(&nft_collection_mint.to_account_info(), false)
        .authority(&nft_collection_mint.to_account_info())
        .payer(&payer.to_account_info())
        .update_authority(&nft_collection_mint.to_account_info(), true)
        .master_edition(Some(nft_collection_master_edition))
        .system_program(system_program)
        .sysvar_instructions(sysvar_instructions)
        .spl_token_program(Some(&nft_token_program.to_account_info()))
        .token_standard(TokenStandard::NonFungible)
        .print_supply(PrintSupply::Zero)
        .name(COLLECTION_NAME.to_string())
        .symbol(COLLECTION_SYMBOL.to_string())
        .uri(COLLECTION_METADATA_URI.to_string())
        .collection_details(CollectionDetails::V1 {
            size: 0,
        })
        .seller_fee_basis_points(0)
        .primary_sale_happened(false)
        .is_mutable(true)
        .invoke_signed(nft_collection_mint_signer_seeds)?;

    MintV1CpiBuilder::new(token_metadata_program)
        .token(&nft_collection_ata.to_account_info())
        .token_owner(Some(nft_collection_ata_authority))
        .metadata(nft_collection_metadata)
        .master_edition(Some(nft_collection_master_edition))
        .mint(&nft_collection_mint.to_account_info())
        .payer(&payer.to_account_info())
        .authority(&nft_collection_mint.to_account_info())
        .system_program(system_program)
        .spl_token_program(&nft_token_program.to_account_info())
        .spl_ata_program(&associated_token_program.to_account_info())
        .sysvar_instructions(sysvar_instructions)
        .amount(1)
        .invoke_signed(nft_collection_mint_signer_seeds)?;

    Ok(())
}
