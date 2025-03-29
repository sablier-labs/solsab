use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{lockup::StreamData, nft_collection_data::NftCollectionData, treasury::Treasury},
    utils::constants::*,
};

#[derive(Accounts)]
// Dev: the motivation for this Ix is to save the precious function stack space, by splitting the Stream Creation logic
// into two Ixs
pub struct PrepareForStreamCreation<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(mint::token_program = asset_token_program)]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

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
        seeds = [NFT_COLLECTION_DATA_SEED],
        bump = nft_collection_data.bump
    )]
    pub nft_collection_data: Box<Account<'info, NftCollectionData>>,

    #[account(
        seeds = [NFT_COLLECTION_MINT_SEED],
        bump,
    )]
    pub nft_collection_mint: Box<InterfaceAccount<'info, Mint>>,

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

    pub system_program: Program<'info, System>,
    pub asset_token_program: Interface<'info, TokenInterface>,
    pub nft_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<PrepareForStreamCreation>) -> Result<()> {
    ctx.accounts.stream_data.bump = ctx.bumps.stream_data;
    Ok(())
}
