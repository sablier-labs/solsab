use anchor_lang::prelude::*;
use mpl_core::{instructions::CreateCollectionV2CpiBuilder, programs::MPL_CORE_ID};

use crate::{
    state::treasury::Treasury,
    utils::constants::{
        nft::{COLLECTION_METADATA_URI, COLLECTION_NAME},
        seeds::*,
        ANCHOR_DISCRIMINATOR_SIZE,
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
    /// Create account: the Stream NFT collection.
    #[account(
      mut,
      seeds = [STREAM_NFT_COLLECTION],
      bump
    )]
    /// CHECK: This account will be initialized by the MPL Core program
    pub stream_nft_collection: UncheckedAccount<'info>,

    // -------------------------------------------------------------------------- //
    //                              PROGRAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
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

/// See the documentation for [`fn@crate::sablier_lockup::initialize`].
pub fn handler(
    ctx: Context<Initialize>,
    fee_collector: Pubkey,
    chainlink_program: Pubkey,
    chainlink_sol_usd_feed: Pubkey,
) -> Result<()> {
    ctx.accounts.treasury.initialize(ctx.bumps.treasury, fee_collector, chainlink_program, chainlink_sol_usd_feed)?;

    // Initialize the Stream NFT collection
    let collection_signer_seeds: &[&[&[u8]]] = &[&[STREAM_NFT_COLLECTION, &[ctx.bumps.stream_nft_collection]]];

    CreateCollectionV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .collection(&ctx.accounts.stream_nft_collection.to_account_info())
        .update_authority(Some(&ctx.accounts.treasury.to_account_info()))
        .payer(&ctx.accounts.initializer.to_account_info())
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(COLLECTION_NAME.to_string())
        .uri(COLLECTION_METADATA_URI.to_string())
        .invoke_signed(collection_signer_seeds)?;

    Ok(())
}
