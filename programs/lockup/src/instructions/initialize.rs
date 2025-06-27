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
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(
      init,
      payer = initializer,
      seeds = [TREASURY],
      space = ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
      bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    #[account(
      init,
      payer = initializer,
      seeds = [NFT_COLLECTION_DATA],
      space = ANCHOR_DISCRIMINATOR_SIZE + NftCollectionData::INIT_SPACE,
      bump
    )]
    pub nft_collection_data: Box<Account<'info, NftCollectionData>>,

    #[account(
      init,
      payer = initializer,
      seeds = [NFT_COLLECTION_MINT],
      bump,
      mint::decimals = 0,
      mint::authority = nft_collection_mint,
      mint::freeze_authority = nft_collection_mint,
      mint::token_program = nft_token_program,
    )]
    pub nft_collection_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      init,
      payer = initializer,
      associated_token::mint = nft_collection_mint,
      associated_token::authority = treasury,
      associated_token::token_program = nft_token_program
    )]
    pub nft_collection_ata: Box<InterfaceAccount<'info, TokenAccount>>,

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

    pub nft_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}

/// See the documentation of the {lib.rs#initialize} function.
pub fn handler(ctx: Context<Initialize>, fee_collector: Pubkey) -> Result<()> {
    ctx.accounts.treasury.initialize(ctx.bumps.treasury, fee_collector)?;
    ctx.accounts.nft_collection_data.initialize(ctx.bumps.nft_collection_data)?;

    nft::initialize_collection(
        &ctx.accounts.nft_collection_mint,
        &ctx.accounts.nft_collection_ata,
        &ctx.accounts.nft_collection_metadata,
        &ctx.accounts.nft_collection_master_edition,
        &ctx.accounts.initializer,
        &ctx.accounts.token_metadata_program,
        &ctx.accounts.nft_token_program,
        &ctx.accounts.system_program,
        &ctx.accounts.rent,
        ctx.bumps.nft_collection_mint,
    )?;

    Ok(())
}
