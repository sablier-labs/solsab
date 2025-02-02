use anchor_lang::{prelude::*, solana_program::sysvar::clock::Clock};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    state::{lockup, treasury::Treasury},
    utils::{constants::ANCHOR_DISCRIMINATOR_SIZE, errors::ErrorCode},
};

#[derive(Accounts)]
pub struct CreateWithTimestamps<'info> {
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
        space = ANCHOR_DISCRIMINATOR_SIZE + lockup::Stream::INIT_SPACE,
        bump
    )]
    // TODO: implement NFT logic to allow multiple Streams between the same sender and recipient (wrt their ATAs)
    pub stream: Box<Account<'info, lockup::Stream>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<CreateWithTimestamps>,
    start_time: i64,
    cliff_time: i64,
    end_time: i64,
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
    if end_time <= current_time {
        return Err(ErrorCode::InvalidEndTime.into());
    }

    // Assert that the cliff time is strictly between the start and end times
    if cliff_time <= start_time || cliff_time >= end_time {
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

    let milestones: lockup::Milestones = lockup::Milestones { start_time, cliff_time, end_time };
    let amounts = lockup::Amounts { deposited: deposited_amount, withdrawn: 0, refunded: 0 };

    // Initialize the fields of the newly created Stream
    **ctx.accounts.stream = lockup::Stream {
        sender_ata: sender_ata.key(),
        recipient_ata: ctx.accounts.recipient_ata.key(),
        token_mint_account: mint.key(),
        amounts,
        milestones,
        is_cancelable,
        was_canceled: false,
        bump: ctx.bumps.stream,
    };

    Ok(())
}
