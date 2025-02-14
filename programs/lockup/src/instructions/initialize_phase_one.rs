use anchor_lang::prelude::*;

use crate::{
    state::{nft_collection_data::NftCollectionData, treasury::Treasury},
    utils::constants::ANCHOR_DISCRIMINATOR_SIZE,
};

#[derive(Accounts)]
pub struct InitializePhaseOne<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        seeds = [b"treasury"],
        space = ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
        bump
    )]
    // TODO: merge the treasury with nft_collection_data?
    pub treasury: Box<Account<'info, Treasury>>,

    #[account(
        init,
        payer = signer,
        seeds = [b"nft_collection_data"],
        space = ANCHOR_DISCRIMINATOR_SIZE + NftCollectionData::INIT_SPACE,
        bump
    )]
    pub nft_collection_data: Box<Account<'info, NftCollectionData>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializePhaseOne>) -> Result<()> {
    ctx.accounts.treasury.bump = ctx.bumps.treasury;

    ctx.accounts.nft_collection_data.bump = ctx.bumps.nft_collection_data;
    ctx.accounts.nft_collection_data.total_supply = 0;

    Ok(())
}
