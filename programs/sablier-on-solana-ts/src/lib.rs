use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, TokenAccount, Token, Transfer as SplTransfer, Mint}, 
};

pub mod errors;
use errors::ErrorCode;


declare_id!("D66QHFxwZynfc2NfxTogm8M62T6SUBcuASPcxqMoTjgF");

pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;


#[program]
pub mod solsab {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury_pda;
        treasury.bump = ctx.bumps.treasury_pda;

        Ok(())
    }

    pub fn create_lockup_linear_stream(ctx: Context<CreateLockupLinearStream>, amount: u64, is_cancelable: bool) -> Result<()> {
        let sender = &ctx.accounts.sender;
        let sender_ata = &ctx.accounts.sender_ata;
        let program_ata = &ctx.accounts.program_ata;

        // Transfer the SPL tokens to the Treasury's ATA
        // Prepare the transfer instruction
        let transfer_ix = SplTransfer {
            from: sender_ata.to_account_info().clone(),
            to: program_ata.to_account_info().clone(),
            authority: sender.to_account_info().clone(),
        };
        
        // Execute the transfer
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_ix);
        transfer(cpi_ctx, amount)?;

        let recipient_ata = &ctx.accounts.recipient_ata;
        let stream = &mut ctx.accounts.stream;
        stream.sender_ata = sender_ata.key();
        stream.recipient_ata = recipient_ata.key();
        stream.token_mint_account = ctx.accounts.sender_ata.mint;
        stream.total_stream_amount = amount;
        stream.is_cancelable = is_cancelable;
        stream.was_canceled = false;

        Ok(())
    }

    pub fn cancel_lockup_linear_stream(ctx: Context<CancelLockupLinearStream>) -> Result<()> {
        let sender = &ctx.accounts.sender;
        let stream = &mut ctx.accounts.stream;
        let sender_ata = &ctx.accounts.sender_ata;
        let recipient_ata = &ctx.accounts.recipient_ata;

        // Check if the Stream is cancelable
        if !stream.is_cancelable {
            return Err(ErrorCode::StreamIsNotCancelable.into());
        }

        // Check if the Stream was already canceled
        if stream.was_canceled {
            return Err(ErrorCode::StreamIsAlreadyCanceled.into());
        }

        // TODO: Transfer the streamed SPL tokens to the recipient
        // TODO: Transfer the unstreamed SPL tokens back to the sender

        // Mark the Stream as canceled
        stream.was_canceled = true;
        Ok(())
    }


    pub fn renounce_stream_cancelability(ctx: Context<RenounceStreamCancelability>) -> Result<()> {
        let stream = &mut ctx.accounts.stream;

        // Check if the Stream is cancelable
        if !stream.is_cancelable {
            return Err(ErrorCode::StreamCancelabilityIsAlreadyRenounced.into());
        }

        // Mark the Stream as non-cancelable
        stream.is_cancelable = false;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury_pda: Account<'info, Treasury>,

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct CreateLockupLinearStream<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut, 
        constraint = sender_ata.owner == sender.key(),
        constraint = sender_ata.mint == mint.key()
    )]
    pub sender_ata: Account<'info, TokenAccount>,

    #[account(
        mut, 
        constraint = recipient_ata.mint == mint.key()
    )]
    pub recipient_ata: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"treasury"],
        bump
    )]
    pub treasury_pda: Account<'info, Treasury>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = treasury_pda,
    )]
    pub program_ata: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = sender,
        seeds = [b"LL_stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        space = ANCHOR_DISCRIMINATOR_SIZE + Stream::INIT_SPACE,
        bump
    )]
    // TODO: find a way to allow multiple Streams between the same sender and recipient (wrt their ATAs)
    // idea: introduce a nonce in the form of the recent blockhash?
    pub stream: Account<'info, Stream>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>, //TODO: also implement the support for the Token2022 standard (via the interface?)
    pub associated_token_program: Program<'info, AssociatedToken>,
}


#[derive(Accounts)]
pub struct CancelLockupLinearStream<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [b"LL_stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        bump
    )]
    pub stream: Account<'info, Stream>,

    #[account(
        mut, 
        constraint = sender_ata.owner == sender.key(),
    )]
    pub sender_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_ata: Account<'info, TokenAccount>,
}


#[derive(Accounts)]
pub struct RenounceStreamCancelability<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [b"LL_stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        bump
    )]
    pub stream: Account<'info, Stream>,

    #[account(
        mut, 
        constraint = sender_ata.owner == sender.key(),
    )]
    pub sender_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_ata: Account<'info, TokenAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct Stream {
    pub sender_ata: Pubkey,
    pub recipient_ata: Pubkey,
    pub token_mint_account: Pubkey,
    pub total_stream_amount: u64,
    pub is_cancelable: bool,
    pub was_canceled: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub bump: u8,
}
