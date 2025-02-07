use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::{nft_collection_data::NftCollectionData, treasury::Treasury};

#[derive(Accounts)]
// Dev: the motivation for this Ix is to save the precious function stack space, by splitting the Stream Creation logic
// into two Ixs
pub struct PrepareForStreamCreation<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    // The Token Program of the Asset Mint is not enforced (via `#[account(mint::token_program = token_program)]`), as
    // we want to support different token programs for the Asset Mint and the Stream NFT Mint
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        seeds = [b"treasury"],
        bump = treasury_pda.bump
    )]
    pub treasury_pda: Box<Account<'info, Treasury>>,

    #[account(
        init_if_needed, // Dev: `init_if_needed` is used to allow for a smooth Tx sequencing in case of a concurrency (i.e. multiple streams being created at the same time)
        payer = sender,
        associated_token::mint = asset_mint,
        associated_token::authority = treasury_pda,
        // associated_token::token_program = token_program
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [b"nft_collection_data".as_ref()],
        bump = nft_collection_data.bump
    )]
    pub nft_collection_data: Box<Account<'info, NftCollectionData>>,

    #[account(
        seeds = [b"nft_collection_mint".as_ref()],
        bump,
    )]
    pub nft_collection_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed, // Dev: `init_if_needed` is used to allow for a smooth Tx sequencing in case of a concurrency (i.e. multiple streams being created at the same time)
        payer = sender,
        seeds = [b"stream_nft_mint",
                 nft_collection_data.nfts_total_supply.to_le_bytes().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = nft_collection_mint,
        mint::freeze_authority = nft_collection_mint,
        mint::token_program = token_program,
    )]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(_ctx: Context<PrepareForStreamCreation>) -> Result<()> {
    Ok(())
}
