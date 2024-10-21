use std::mem::size_of;

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, TokenAccount, Token, Transfer as SplTransfer};

declare_id!("D66QHFxwZynfc2NfxTogm8M62T6SUBcuASPcxqMoTjgF");

#[program]
pub mod solsab {
    use super::*;

    pub fn create_lockup_linear_stream(ctx: Context<CreateLockupLinearStream>, amount: u64) -> Result<()> {
        let token_program = &ctx.accounts.token_program;
        let sender_ata = &ctx.accounts.sender_ata;
        let recipient_ata = &ctx.accounts.recipient_ata;

        let cpi_accounts = SplTransfer {
            from: sender_ata.to_account_info().clone(),
            to: recipient_ata.to_account_info().clone(),
            authority: sender_ata.to_account_info().clone(),
        };
        let cpi_program = token_program.to_account_info();
        
        transfer(
            CpiContext::new(cpi_program, cpi_accounts),
            amount)?;

        let stream = &mut ctx.accounts.stream;
        stream.sender = sender_ata.key();
        stream.recipient = recipient_ata.key();
        stream.token_mint_account = ctx.accounts.sender_ata.mint;
        stream.total_stream_amount = amount;

        Ok(())
    }

    pub fn get_lockup_linear_stream(_ctx: Context<GetLockupLinearStream>) -> Result<()> {
        Ok(())
    }
}


#[derive(Accounts)]
pub struct CreateLockupLinearStream<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut, 
        constraint = sender_ata.owner == *sender.key
    )]
    pub sender_ata: Account<'info, TokenAccount>,

    #[account(
        mut, 
        constraint = recipient_ata.mint == sender_ata.mint
    )]
    pub recipient_ata: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        seeds = [b"stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        payer = sender,
        space = 8 + size_of::<Stream>(),
        bump)]
    // TODO: find a way to allow multiple Streams between the same sender and recipient (wrt their ATAs)
    // idea: introduce a nonce in the form of the recent blockhash?
    pub stream: Account<'info, Stream>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetLockupLinearStream<'info> {
    #[account()]
    pub sender_ata: Account<'info, TokenAccount>,

    #[account(
        constraint = recipient_ata.mint == sender_ata.mint
    )]
    pub recipient_ata: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [b"stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        bump = stream.bump,
    )]
    pub stream: Account<'info, Stream>,
}

#[account]
pub struct Stream {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub token_mint_account: Pubkey,
    pub total_stream_amount: u64,
    pub bump: u8,
}
