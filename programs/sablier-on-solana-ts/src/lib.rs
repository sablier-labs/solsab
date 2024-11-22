use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, TransferChecked, TokenAccount, Mint, TokenInterface}
};
use anchor_lang::solana_program::sysvar::{clock::Clock, Sysvar};

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

    pub fn create_lockup_linear_stream(ctx: Context<CreateLockupLinearStream>, start_time:  i64, cliff_time:  i64, end_time:  i64, amount: u64, is_cancelable: bool) -> Result<()> {
        let sender = &ctx.accounts.sender;
        let sender_ata = &ctx.accounts.sender_ata;
        let program_ata = &ctx.accounts.program_ata;
        let mint = &ctx.accounts.mint;

        // Assert that the deposited amount is not zero
        if amount == 0 {
            return Err(ErrorCode::InvalidDepositAmount.into());
        }

        // Assert that the end time is greater than the start time and is not in the past
        let current_time = Clock::get().unwrap().unix_timestamp;
        if end_time <= start_time || end_time <= current_time {
            return Err(ErrorCode::InvalidStartOrEndTime.into());
        }

        // Assert that the cliff time is strictly between the start and end times
        if start_time >= cliff_time || cliff_time >= end_time {
            return Err(ErrorCode::InvalidCliffTime.into());
        }

        // Transfer the SPL tokens to the Treasury's ATA
        // Prepare the transfer instruction
        let transfer_ix = TransferChecked {
            from: sender_ata.to_account_info(),
            mint: mint.to_account_info(),
            to: program_ata.to_account_info(),
            authority: sender.to_account_info(),
        };
        
        // Execute the transfer
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_ix);
        transfer_checked(cpi_ctx, amount, mint.decimals)?;

        let recipient_ata = &ctx.accounts.recipient_ata;
        let stream = &mut ctx.accounts.stream;
        stream.sender_ata = sender_ata.key();
        stream.recipient_ata = recipient_ata.key();
        stream.token_mint_account = mint.key();

        // TODO: shouldn't the Amounts field be allocated manually?
        stream.amounts.deposited = amount;
        

        stream.start_time = start_time;
        stream.end_time = end_time;
        stream.is_cancelable = is_cancelable;
        stream.was_canceled = false;

        Ok(())
    }

    pub fn cancel_lockup_linear_stream(ctx: Context<CancelLockupLinearStream>) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        let sender_ata = &ctx.accounts.sender_ata;
        let recipient_ata = &ctx.accounts.recipient_ata;
        let program_ata = &ctx.accounts.program_ata;
        let mint = &ctx.accounts.mint;

        // Check if the Stream is cancelable
        if !stream.is_cancelable {
            return Err(ErrorCode::StreamIsNotCancelable.into());
        }

        // Check if the Stream was already canceled
        if stream.was_canceled {
            return Err(ErrorCode::StreamIsAlreadyCanceled.into());
        }

        // Calculate the streamed amount
        let streamed_amount = get_streamed_amount(stream);

        // Transfer the streamed SPL tokens to the recipient
        // Prepare the transfer instruction
        let transfer_ix = TransferChecked {
            from: program_ata.to_account_info(),
            mint: mint.to_account_info(),
            to: recipient_ata.to_account_info(),
            authority: program_ata.to_account_info(),
        };
        
        // Execute the transfer
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_ix);
        transfer_checked(cpi_ctx, streamed_amount, mint.decimals)?;

        // Calculate the unstreamed amount
        let unstreamed_amount = stream.amounts.deposited - streamed_amount;

        // Transfer the unstreamed SPL tokens back to the sender
        // Prepare the transfer instruction
        let transfer_ix = TransferChecked {
            from: program_ata.to_account_info(),
            mint: mint.to_account_info(),
            to: sender_ata.to_account_info(),
            authority: program_ata.to_account_info(),
        };

        // Execute the transfer
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_ix);
        transfer_checked(cpi_ctx, unstreamed_amount, mint.decimals)?;

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

    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut, 
        associated_token::mint = mint,
        associated_token::authority = sender,
        associated_token::token_program = token_program
    )]
    pub sender_ata: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: The recipient may be any account, as long as it is the authority of recipient_ata
    pub recipient: UncheckedAccount<'info>,

    #[account(
        mut, 
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program
    )]
    pub recipient_ata: InterfaceAccount<'info, TokenAccount>,

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
        associated_token::token_program = token_program
    )]
    pub program_ata: InterfaceAccount<'info, TokenAccount>,
    
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
    pub token_program: Interface<'info, TokenInterface>,
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

    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut, 
        constraint = sender_ata.owner == sender.key(),
    )]
    pub sender_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        seeds = [b"treasury"],
        bump
    )]
    pub treasury_pda: Account<'info, Treasury>,

    #[account(
        mut,
        associated_token::mint = sender_ata.mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program
    )]
    pub program_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
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
    pub sender_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_ata: InterfaceAccount<'info, TokenAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct Stream {
    pub sender_ata: Pubkey,
    pub recipient_ata: Pubkey,
    pub token_mint_account: Pubkey,
    pub amounts: Amounts,
    pub start_time: i64,
    pub cliff_time: i64,
    pub end_time: i64,
    pub is_cancelable: bool,
    pub was_canceled: bool,
    pub bump: u8,
}

#[derive(Clone, InitSpace, anchor_lang::AnchorSerialize, anchor_lang::AnchorDeserialize)]
pub struct Amounts {
    pub deposited: u64,
    pub withdrawn: u64,
    pub refunded: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub bump: u8,
}


pub fn get_streamed_amount(stream: &Stream) -> u64 {
    let current_time = Clock::get().unwrap().unix_timestamp;

    if stream.cliff_time > current_time || stream.start_time > current_time {
        return 0; // No assets have been streamed yet
    }

    if stream.end_time < current_time {
        return stream.amounts.deposited; // All assets have been streamed
    }

    // Calculate the streamed amount
    let elapsed_time = current_time - stream.start_time;
    let total_duration = stream.end_time - stream.start_time;
    (stream.amounts.deposited as u128 * elapsed_time as u128 / total_duration as u128) as u64
}
