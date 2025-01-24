use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

use crate::{state::lockup_stream::Stream, utils::errors::ErrorCode};

#[derive(Accounts)]
pub struct Renounce<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [b"LL_stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        bump = stream.bump
    )]
    pub stream: Box<Account<'info, Stream>>,

    #[account(
        mut,
        constraint = sender_ata.owner == sender.key(),
    )]
    pub sender_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,
}

pub fn handler(ctx: Context<Renounce>) -> Result<()> {
    let stream = &mut ctx.accounts.stream;

    // Assert that the Stream is cancelable
    if !stream.is_cancelable {
        return Err(ErrorCode::StreamCancelabilityIsAlreadyRenounced.into());
    }

    // Mark the Stream as non-cancelable
    stream.is_cancelable = false;

    Ok(())
}
