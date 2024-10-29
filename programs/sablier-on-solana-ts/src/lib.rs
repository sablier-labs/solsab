use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, TokenAccount, Token, Transfer as SplTransfer, Mint};

use anchor_spl::associated_token::AssociatedToken;

declare_id!("D66QHFxwZynfc2NfxTogm8M62T6SUBcuASPcxqMoTjgF");

pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;

#[program]
pub mod solsab {
    use super::*;

    pub fn create_lockup_linear_stream(ctx: Context<CreateLockupLinearStream>, amount: u64) -> Result<()> {
        //let sender = &ctx.accounts.sender;
        let sender_ata = &ctx.accounts.sender_ata;
        let program_ata = &ctx.accounts.program_ata;

        let acc_info = ctx.accounts.sender.to_account_info();
        // Prepare the transfer instruction
        let transfer_ix = SplTransfer {
            from: sender_ata.to_account_info(),
            to: program_ata.to_account_info(),
            authority: acc_info,
        };

        // Execute the transfer
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_ix);
        transfer(cpi_ctx, amount)?;

        msg!("Transferred the SPL tokens to the Treasury ATA");

        let recipient_ata = &ctx.accounts.recipient_ata;
        let stream = &mut ctx.accounts.stream;
        stream.sender_ata = sender_ata.key();
        stream.recipient_ata = recipient_ata.key();
        stream.token_mint_account = ctx.accounts.sender_ata.mint;
        stream.total_stream_amount = amount;

        Ok(())
    }
}


#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct CreateLockupLinearStream<'info> {
    // #[account(mut)]
    // pub sender: Signer<'info>,
    
    /// CHECK: explanation for why no checks through types are necessary.
    #[account(mut, signer)]
    pub sender: AccountInfo<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut, 
        constraint = sender_ata.owner == *sender.key,
        constraint = sender_ata.mint == mint.key()
    )]
    pub sender_ata: Account<'info, TokenAccount>,

    #[account(
        mut, 
        constraint = recipient_ata.mint == mint.key()
    )]
    pub recipient_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = treasury_pda,
    )]
    pub program_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        seeds = [b"treasury"],
        payer = sender,
        space = ANCHOR_DISCRIMINATOR_SIZE + Treasury::INIT_SPACE,
        bump
    )]
    pub treasury_pda: Account<'info, Treasury>,
    
    #[account(
        init_if_needed,
        seeds = [b"stream", sender_ata.key().as_ref(), recipient_ata.key().as_ref()],
        payer = sender,
        space = ANCHOR_DISCRIMINATOR_SIZE + Stream::INIT_SPACE,
        bump)]
    // TODO: find a way to allow multiple Streams between the same sender and recipient (wrt their ATAs)
    // idea: introduce a nonce in the form of the recent blockhash?
    pub stream: Account<'info, Stream>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>, //TODO: also implement the support for the Token2022 standard (via the interface?)
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[account]
#[derive(InitSpace)]
pub struct Stream {
    pub sender_ata: Pubkey,
    pub recipient_ata: Pubkey,
    pub token_mint_account: Pubkey,
    pub total_stream_amount: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub bump: u8,
}
