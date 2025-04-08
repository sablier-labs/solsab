use anchor_lang::{prelude::*, solana_program::program::invoke};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    state::{lockup::StreamData, treasury::Treasury},
    utils::{constants::*, errors::ErrorCode, events::StreamWithdrawal, streaming_math::get_withdrawable_amount},
};

const WITHDRAWAL_FEE_LAMPORTS: u64 = 10_000_000; // 0.01 SOL

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(address = stream_data.asset_mint)]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account()]
    /// CHECK: This account must be the Stream's recipient (checked in recipients_stream_nft_ata's constraints)
    pub recipient: UncheckedAccount<'info>,

    #[account(
        seeds = [STREAM_NFT_MINT_SEED,
                 stream_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub stream_nft_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [STREAM_DATA_SEED,
                 stream_nft_mint.key().as_ref()],
        bump = stream_data.bump,
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    #[account(
        mut,
        associated_token::mint = stream_nft_mint,
        associated_token::authority = recipient,
        associated_token::token_program = nft_token_program,
        // Dev: the below constraint is vital for making sure that the assets are only withdrawn to the legit recipient
        constraint = recipients_stream_nft_ata.amount == 1,
        // TODO: are there any other ways in which one could "fake" the recipient's authority (and that need to be checked in this Ix)?
    )]
    pub recipients_stream_nft_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = asset_mint,
        associated_token::authority = recipient,
        associated_token::token_program = asset_token_program,
    )]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = treasury,
        associated_token::token_program = asset_token_program
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub asset_token_program: Interface<'info, TokenInterface>,
    pub nft_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Assert that the withdrawn amount is not zero
    if amount == 0 {
        return Err(ErrorCode::WithdrawalAmountCannotBeZero.into());
    }

    // Calculate the withdrawable amount
    let withdrawable_amount =
        get_withdrawable_amount(&ctx.accounts.stream_data.milestones, &ctx.accounts.stream_data.amounts);

    // Assert that the withdrawable amount is not too big
    if amount > withdrawable_amount {
        return Err(ErrorCode::InvalidWithdrawalAmount.into());
    }

    // Collect the withdrawal fee from the tx signer
    let fee_collection_ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.signer.key(),
        &ctx.accounts.treasury.key(),
        WITHDRAWAL_FEE_LAMPORTS,
    );
    invoke(&fee_collection_ix, &[ctx.accounts.signer.to_account_info(), ctx.accounts.treasury.to_account_info()])?;

    let treasury = &mut ctx.accounts.treasury;

    // Transfer the withdrawable SPL tokens to the recipient
    // Prepare the transfer instruction
    let transfer_ix = TransferChecked {
        from: ctx.accounts.treasury_ata.to_account_info().clone(),
        mint: ctx.accounts.asset_mint.to_account_info(),
        to: ctx.accounts.recipient_ata.to_account_info(),
        authority: treasury.to_account_info(),
    };

    // Wrap the Treasury PDA's seeds in the appropriate structure
    let signer_seeds: &[&[&[u8]]] = &[&[TREASURY_SEED, &[treasury.bump]]];

    // Execute the transfer
    let cpi_ctx =
        CpiContext::new_with_signer(ctx.accounts.asset_token_program.to_account_info(), transfer_ix, signer_seeds);
    transfer_checked(cpi_ctx, amount, ctx.accounts.asset_mint.decimals)?;

    let stream_amounts = &mut ctx.accounts.stream_data.amounts;

    // Update the Stream's withdrawn amount
    stream_amounts.withdrawn = stream_amounts.withdrawn.checked_add(amount).expect("Withdrawn amount overflow");

    // Mark the Stream as non-cancelable if it has been depleted
    //
    // Note: the `>=` operator is used as an extra safety measure for the case when the withdrawn amount is bigger than
    // expected, for one reason or the other
    if stream_amounts.withdrawn >= stream_amounts.deposited - stream_amounts.refunded {
        ctx.accounts.stream_data.is_cancelable = false;
    }

    // Emit an event indicating the withdrawal
    emit!(StreamWithdrawal { stream_id: ctx.accounts.stream_data.id, withdrawn_amount: amount });

    Ok(())
}
