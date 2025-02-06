use anchor_lang::prelude::*;

use crate::{
    state::{nft_collection_data::NftCollectionData, treasury::Treasury},
    utils::constants::{self, ANCHOR_DISCRIMINATOR_SIZE},
};

#[derive(Accounts)]
pub struct InitializePhaseOne<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = constants::ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
        seeds = [b"treasury"],
        bump
    )]
    // TODO: merge the treasury with nft_collection_data?
    pub treasury_pda: Box<Account<'info, Treasury>>,

    #[account(
        init,
        payer = signer,
        space = ANCHOR_DISCRIMINATOR_SIZE + NftCollectionData::INIT_SPACE,
        seeds = [b"nft_collection_data".as_ref()],
        bump
    )]
    pub nft_collection_data: Box<Account<'info, NftCollectionData>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializePhaseOne>) -> Result<()> {
    ctx.accounts.treasury_pda.bump = ctx.bumps.treasury_pda;

    ctx.accounts.nft_collection_data.bump = ctx.bumps.nft_collection_data;
    ctx.accounts.nft_collection_data.nfts_total_supply = 0;

    Ok(())
}
