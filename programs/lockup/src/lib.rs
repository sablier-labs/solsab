use anchor_lang::{
    prelude::*,
    solana_program::sysvar::{clock::Clock, Sysvar},
    AnchorDeserialize, AnchorSerialize,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

pub mod utils;
use utils::{get_streamed_amount, get_withdrawable_amount, internal_withdraw};

pub mod errors;
use errors::ErrorCode;

declare_id!("D66QHFxwZynfc2NfxTogm8M62T6SUBcuASPcxqMoTjgF"); // Localnet Program ID

// declare_id!("uwuJk35aCL3z2FzfPr8fQE1U19A8N18qdA5YfdfUbPt"); // Devnet Program ID

pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;

#[program]
pub mod lockup {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.treasury_pda.bump = ctx.bumps.treasury_pda;

        Ok(())
    }

    pub fn create_lockup_linear_stream(
        ctx: Context<CreateLockupLinearStream>,
        milestones: Milestones,
        deposited_amount: u64,
        is_cancelable: bool,
    ) -> Result<()> {
        let sender = &ctx.accounts.sender;
        let sender_ata = &ctx.accounts.sender_ata;
        let treasury_ata = &ctx.accounts.treasury_ata;
        let mint = &ctx.accounts.mint;

        // Assert that the deposited amount is not zero
        if deposited_amount == 0 {
            return Err(ErrorCode::InvalidDepositAmount.into());
        }

        let current_time = Clock::get().unwrap().unix_timestamp;

        // Assert that the end time is not in the past
        if milestones.end_time <= current_time {
            return Err(ErrorCode::InvalidEndTime.into());
        }

        // Assert that the cliff time is strictly between the start and end times
        if milestones.cliff_time <= milestones.start_time || milestones.cliff_time >= milestones.end_time {
            return Err(ErrorCode::InvalidCliffTime.into());
        }

        // Prepare the instruction to transfer the SPL tokens to the Treasury's ATA
        let transfer_ix = TransferChecked {
            from: sender_ata.to_account_info(),
            mint: mint.to_account_info(),
            to: treasury_ata.to_account_info(),
            authority: sender.to_account_info(),
        };

        // Execute the transfer
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_ix);
        transfer_checked(cpi_ctx, deposited_amount, mint.decimals)?;

        // Initialize the fields of the newly created Stream
        **ctx.accounts.stream = Stream {
            sender_ata: sender_ata.key(),
            recipient_ata: ctx.accounts.recipient_ata.key(),
            token_mint_account: mint.key(),
            amounts: Amounts { deposited: deposited_amount, withdrawn: 0, refunded: 0 },
            milestones,
            is_cancelable,
            was_canceled: false,
            bump: ctx.bumps.stream,
        };

        Ok(())
    }

    pub fn cancel_lockup_linear_stream(ctx: Context<CancelLockupLinearStream>) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        let sender_ata = &ctx.accounts.sender_ata;
        let treasury_ata = &ctx.accounts.treasury_ata;
        let treasury_pda = &ctx.accounts.treasury_pda;
        let mint = &ctx.accounts.mint;

        // Assert that the Stream is cancelable
        if !stream.is_cancelable {
            return Err(ErrorCode::StreamIsNotCancelable.into());
        }

        // Calculate the refundable amount
        let refundable_amount = stream.amounts.deposited - get_streamed_amount(stream);

        if refundable_amount > 0 {
            // Prepare the instruction to transfer the refundable SPL tokens back to the sender
            let transfer_ix = TransferChecked {
                from: treasury_ata.to_account_info(),
                mint: mint.to_account_info(),
                to: sender_ata.to_account_info(),
                authority: treasury_pda.to_account_info(),
            };

            // Wrap the Treasury PDA's seeds in the appropriate structure
            let signer_seeds: &[&[&[u8]]] = &[&[b"treasury", &[ctx.accounts.treasury_pda.bump]]];

            // Execute the transfer
            let cpi_ctx =
                CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), transfer_ix, signer_seeds);
            transfer_checked(cpi_ctx, refundable_amount, mint.decimals)?;

            // Update the Stream field tracking the refunded amount
            stream.amounts.refunded = refundable_amount;
        }

        // Dev: We're not sending the streamed amount to the recipient to prevent a potential misuse by transferring the
        // Stream to a censored address (e.g. Tornado Cash) after the cancelation intent is known.

        // Mark the Stream as canceled
        stream.was_canceled = true;

        // Mark the Stream as non-cancelable
        stream.is_cancelable = false;

        Ok(())
    }

    pub fn renounce_stream_cancelability(ctx: Context<RenounceStreamCancelability>) -> Result<()> {
        let stream = &mut ctx.accounts.stream;

        // Assert that the Stream is cancelable
        if !stream.is_cancelable {
            return Err(ErrorCode::StreamCancelabilityIsAlreadyRenounced.into());
        }

        // Mark the Stream as non-cancelable
        stream.is_cancelable = false;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        internal_withdraw(
            &mut ctx.accounts.stream,
            ctx.accounts.recipient_ata.to_account_info(),
            ctx.accounts.treasury_ata.to_account_info(),
            &ctx.accounts.treasury_pda,
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint.decimals,
            ctx.accounts.token_program.to_account_info(),
            amount,
        )
    }

    pub fn withdraw_max(ctx: Context<WithdrawMax>) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        let withdrawable_amount = get_withdrawable_amount(stream);

        internal_withdraw(
            stream,
            ctx.accounts.recipient_ata.to_account_info(),
            ctx.accounts.treasury_ata.to_account_info(),
            &ctx.accounts.treasury_pda,
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint.decimals,
            ctx.accounts.token_program.to_account_info(),
            withdrawable_amount,
        )
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
    pub treasury_pda: Box<Account<'info, Treasury>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateLockupLinearStream<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = sender,
        associated_token::token_program = token_program
    )]
    pub sender_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: The recipient may be any account, as long as it is the authority of recipient_ata
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program,
    )]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [b"treasury"],
        bump = treasury_pda.bump
    )]
    pub treasury_pda: Box<Account<'info, Treasury>>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = sender,
        seeds = [b"LL_stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        space = ANCHOR_DISCRIMINATOR_SIZE + Stream::INIT_SPACE,
        bump
    )]
    // TODO: implement NFT logic to allow multiple Streams between the same sender and recipient (wrt their ATAs)
    pub stream: Box<Account<'info, Stream>>,

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
        bump = stream.bump
    )]
    pub stream: Box<Account<'info, Stream>>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = sender_ata.owner == sender.key(),
    )]
    pub sender_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury_pda.bump
    )]
    pub treasury_pda: Box<Account<'info, Treasury>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program,
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RenounceStreamCancelability<'info> {
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

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"LL_stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        bump = stream.bump
    )]
    pub stream: Box<Account<'info, Stream>>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub sender_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury_pda.bump
    )]
    pub treasury_pda: Box<Account<'info, Treasury>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawMax<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"LL_stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        bump = stream.bump
    )]
    pub stream: Box<Account<'info, Stream>>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub sender_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury_pda.bump
    )]
    pub treasury_pda: Box<Account<'info, Treasury>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[account]
#[derive(InitSpace)]
pub struct Stream {
    pub sender_ata: Pubkey,
    pub recipient_ata: Pubkey,
    pub token_mint_account: Pubkey,
    pub amounts: Amounts,
    pub milestones: Milestones,
    pub is_cancelable: bool,
    pub was_canceled: bool,
    pub bump: u8,
}

#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Amounts {
    pub deposited: u64,
    pub withdrawn: u64,
    pub refunded: u64,
}

#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Milestones {
    pub start_time: i64,
    pub cliff_time: i64,
    pub end_time: i64,
}

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub bump: u8,
}
