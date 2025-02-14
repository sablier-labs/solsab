use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3,
        mpl_token_metadata::types::{CollectionDetails, Creator, DataV2},
        sign_metadata, CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata, SignMetadata,
    },
    token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface},
};

#[constant]
pub const NFT_NAME: &str = "Sablier Lockup Linear Streams";
#[constant]
pub const NFT_URI: &str = "[The URI for the JSON containing the NFT metadata]";
#[constant]
pub const NFT_SYMBOL: &str = "LL_STREAMS";

#[derive(Accounts)]
pub struct InitializePhaseTwo<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        seeds = [b"nft_collection_mint"],
        bump,
        mint::decimals = 0,
        mint::authority = nft_collection_mint,
        mint::freeze_authority = nft_collection_mint,
        mint::token_program = nft_token_program,
    )]
    pub nft_collection_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = signer,
        seeds = [b"collection_token_account"],
        bump,

        token::mint = nft_collection_mint,
        token::authority = nft_collection_token_account,
        token::token_program = nft_token_program
        
        // TODO: why is the SolSab program - and not a token program - being paired with the seeds in this init?

        // TODO: Why can't the associated token constraints be used, instead?
        // associated_token::mint = nft_collection_mint,
        // associated_token::authority = nft_collection_token_account,
        // associated_token::token_program = nft_token_program
    )]
    pub nft_collection_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"metadata", 
                 token_metadata_program.key().as_ref(), 
                 nft_collection_mint.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(), // TODO: why is this necessary if the program key is already added to the seeds?
    )]
    /// CHECK: This account will be initialized by the Metaplex program
    pub nft_collection_metadata: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"metadata", 
                 token_metadata_program.key().as_ref(), 
                 nft_collection_mint.key().as_ref(),
                 b"edition"],
        seeds::program = token_metadata_program.key(),
        bump,
    )]
    /// CHECK: This account will be initialized by the Metaplex program
    pub nft_collection_master_edition: UncheckedAccount<'info>,

    pub nft_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializePhaseTwo>) -> Result<()> {
    let signer = &ctx.accounts.signer;
    let nft_collection_mint = &ctx.accounts.nft_collection_mint;
    let nft_collection_metadata = &ctx.accounts.nft_collection_metadata;
    let token_metadata_program = &ctx.accounts.token_metadata_program;
    let nft_token_program = &ctx.accounts.nft_token_program;
    let system_program = &ctx.accounts.system_program;
    let rent = &ctx.accounts.rent;
    
    let nft_collection_mint_signer_seeds: &[&[&[u8]]] = &[&[b"nft_collection_mint", &[ctx.bumps.nft_collection_mint]]];

    // Mint the Collection NFT
    mint_to(
        CpiContext::new_with_signer(
            nft_token_program.to_account_info(),
            MintTo {
                mint: nft_collection_mint.to_account_info(),
                to: ctx.accounts.nft_collection_token_account.to_account_info(),
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
                payer: signer.to_account_info(),
                system_program: system_program.to_account_info(),
                rent: rent.to_account_info(),
            },
            nft_collection_mint_signer_seeds,
        ),
        DataV2 {
            name: NFT_NAME.to_string(),
            symbol: NFT_SYMBOL.to_string(),
            uri: NFT_URI.to_string(),
            seller_fee_basis_points: 0,
            creators: Some(vec![Creator {
                address: nft_collection_mint.key(),
                verified: false,
                share: 100,
            }]),
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
                payer: signer.to_account_info(),
                mint: nft_collection_mint.to_account_info(),
                edition: ctx.accounts.nft_collection_master_edition.to_account_info(),
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

    // Verify the collection NFT
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
