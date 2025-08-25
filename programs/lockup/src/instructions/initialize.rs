use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::Metadata,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{nft_collection_data::NftCollectionData, treasury::Treasury},
    utils::{
        constants::{seeds::*, ANCHOR_DISCRIMINATOR_SIZE},
        nft,
    },
};

#[derive(Accounts)]
pub struct Initialize<'info> {
    // -------------------------------------------------------------------------- //
    //                               USER ACCOUNTS                                //
    // -------------------------------------------------------------------------- //
    /// Write account: the initializer of the program.
    #[account(mut)]
    pub initializer: Signer<'info>,

    // -------------------------------------------------------------------------- //
    //                              SABLIER ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Create account: the treasury account that will hold the fees.
    #[account(
      init,
      payer = initializer,
      seeds = [TREASURY],
      space = ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
      bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    // -------------------------------------------------------------------------- //
    //                         STREAM COLLECTION ACCOUNTS                         //
    // -------------------------------------------------------------------------- //
    /// Create account: the NFT collection data account storing collection metadata.
    #[account(
      init,
      payer = initializer,
      seeds = [NFT_COLLECTION_DATA],
      space = ANCHOR_DISCRIMINATOR_SIZE + NftCollectionData::INIT_SPACE,
      bump
    )]
    pub nft_collection_data: Box<Account<'info, NftCollectionData>>,

    /// Create account: the master edition account for the NFT collection.
    #[account(
      mut,
      seeds = [
        METADATA,
        token_metadata_program.key().as_ref(),
        nft_collection_mint.key().as_ref(),
        EDITION
      ],
      seeds::program = token_metadata_program.key(),
      bump,
    )]
    /// CHECK: This account will be initialized by the Metaplex program
    pub nft_collection_master_edition: UncheckedAccount<'info>,

    /// Create account: the metadata account for the NFT collection.
    #[account(
      mut,
      seeds = [
        METADATA,
        token_metadata_program.key().as_ref(),
        nft_collection_mint.key().as_ref()
      ],
      bump,
      seeds::program = token_metadata_program.key(), // TODO: why is this necessary if the program key is already added to the seeds?
    )]
    /// CHECK: This account will be initialized by the Metaplex program
    pub nft_collection_metadata: UncheckedAccount<'info>,

    /// Create account: the mint account for the NFT collection.
    #[account(
      init,
      payer = initializer,
      seeds = [NFT_COLLECTION_MINT],
      bump,
      mint::authority = nft_collection_mint,
      mint::decimals = 0,
      mint::freeze_authority = nft_collection_mint,
      mint::token_program = nft_token_program,
    )]
    pub nft_collection_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Create account: the ATA for the NFT collection owned by treasury.
    #[account(
      init,
      payer = initializer,
      associated_token::authority = treasury,
      associated_token::mint = nft_collection_mint,
      associated_token::token_program = nft_token_program
    )]
    pub nft_collection_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // -------------------------------------------------------------------------- //
    //                              PROGRAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the Associated Token program.
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Program account: the Token program of the collection NFT.
    pub nft_token_program: Interface<'info, TokenInterface>,

    /// Program account: the Token Metadata program.
    pub token_metadata_program: Program<'info, Metadata>,

    // -------------------------------------------------------------------------- //
    //                               SYSTEM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Sysvar account: Instructions.
    /// CHECK: this account is used exclusively by the Metaplex program
    pub sysvar_instructions: AccountInfo<'info>,

    /// Program account: the System program.
    pub system_program: Program<'info, System>,
}

/// See the documentation for [`fn@crate::sablier_lockup::initialize`].
pub fn handler(
    ctx: Context<Initialize>,
    fee_collector: Pubkey,
    chainlink_program: Pubkey,
    chainlink_sol_usd_feed: Pubkey,
) -> Result<()> {
    ctx.accounts.treasury.initialize(ctx.bumps.treasury, fee_collector, chainlink_program, chainlink_sol_usd_feed)?;
    ctx.accounts.nft_collection_data.initialize(ctx.bumps.nft_collection_data)?;

    nft::initialize_collection(
        &ctx.accounts.nft_collection_mint,
        &ctx.accounts.nft_collection_ata,
        &ctx.accounts.treasury.to_account_info(),
        &ctx.accounts.nft_collection_metadata,
        &ctx.accounts.nft_collection_master_edition,
        &ctx.accounts.initializer,
        &ctx.accounts.token_metadata_program,
        &ctx.accounts.nft_token_program,
        &ctx.accounts.associated_token_program,
        &ctx.accounts.system_program,
        &ctx.accounts.sysvar_instructions,
        ctx.bumps.nft_collection_mint,
    )?;

    Ok(())
}
