use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use chainlink_solana as chainlink;

use crate::{
    state::{Campaign, ClaimReceipt, Treasury},
    utils::{
        constants::{misc::*, seeds::*},
        events,
        transfer_helper::transfer_tokens,
        validations::check_claim,
    },
};

#[derive(Accounts)]
#[instruction(index: u32)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(address = campaign.airdrop_token_mint)]
    pub airdrop_token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      init,
      payer = claimer,
      space = ANCHOR_DISCRIMINATOR_SIZE + ClaimReceipt::INIT_SPACE,
      seeds = [
        CLAIM_RECEIPT_SEED,
        campaign.key().as_ref(),
        index.to_le_bytes().as_ref(),
      ],
      bump
    )]
    pub claim_receipt: Box<Account<'info, ClaimReceipt>>,

    #[account(
      mut,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: This account is validated during the Merkle proof verification.
    pub recipient: UncheckedAccount<'info>,

    #[account(
      init_if_needed,
      payer = claimer,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = recipient,
      associated_token::token_program = airdrop_token_program
    )]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      mut,
      seeds = [TREASURY_SEED],
      bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    /// CHECK: We're reading data from this chainlink feed
    pub chainlink_sol_usd_feed: AccountInfo<'info>,

    /// CHECK: This is the Chainlink program library
    pub chainlink_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub airdrop_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Claim>, index: u32, amount: u64, merkle_proof: Vec<[u8; 32]>) -> Result<()> {
    let campaign = ctx.accounts.campaign.clone();
    let airdrop_token_mint = ctx.accounts.airdrop_token_mint.clone();
    let claimer = ctx.accounts.claimer.clone();
    let recipient = ctx.accounts.recipient.clone();

    // Check: validate the claim.
    check_claim(campaign.expiration_time, campaign.merkle_root, index, recipient.key(), amount, merkle_proof)?;

    ctx.accounts.campaign.claim()?;

    // Interaction: charge the withdrawal fee.
    charge_withdrawal_fee(
        ctx.accounts.chainlink_program.to_account_info(),
        ctx.accounts.chainlink_sol_usd_feed.to_account_info(),
        ctx.accounts.claimer.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
    )?;

    // Interaction: transfer tokens from the Campaign's ATA to the Recipient's ATA.
    transfer_tokens(
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.recipient_ata.to_account_info(),
        campaign.to_account_info(),
        airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        amount,
        airdrop_token_mint.decimals,
        &[&[
            CAMPAIGN_SEED,
            campaign.creator.key().as_ref(),
            campaign.merkle_root.as_ref(),
            campaign.expiration_time.to_le_bytes().as_ref(),
            campaign.name.as_ref(),
            airdrop_token_mint.key().as_ref(),
            &[campaign.bump],
        ]],
    )?;

    // Log the claim.
    emit!(events::Claim {
        amount,
        campaign: campaign.key(),
        claimer: claimer.key(),
        claim_receipt: ctx.accounts.claim_receipt.key(),
        index,
        recipient: recipient.key(),
    });

    Ok(())
}

// TODO: export this into a crate that'd be imported by both the lockup and merkle_instant programs.
fn charge_withdrawal_fee<'info>(
    chainlink_program: AccountInfo<'info>,
    chainlink_sol_usd_feed: AccountInfo<'info>,
    tx_signer: AccountInfo<'info>,
    treasury: AccountInfo<'info>,
) -> Result<()> {
    let round = chainlink::latest_round_data(chainlink_program.clone(), chainlink_sol_usd_feed.clone())?;

    let round_timestamp: i64 = round.timestamp as i64;
    let current_timestamp: i64 = Clock::get()?.unix_timestamp;
    const SECONDS_IN_24_HOURS: i64 = 86400;
    let timestamp_24h_ago = current_timestamp - SECONDS_IN_24_HOURS;

    // Check: only charge the fee if the round data is valid (i.e. its timestamp is strictly within the last 24 hours).
    // Otherwise, skip the fee charging.
    if
    /* current_timestamp > round_timestamp && */
    round_timestamp > timestamp_24h_ago {
        let decimals = chainlink::decimals(chainlink_program.clone(), chainlink_sol_usd_feed.clone())?;

        // Calculate the SOL price in USD as an integer value, truncating the sub-dollar amount.
        let sol_price_usd = (round.answer / 10_i128.pow(decimals as u32)) as u64;

        // Transform the fee from USD to Lamports.
        let fee_in_lamports = (CLAIM_FEE_USD * NO_LAMPORTS_IN_1_SOL) / sol_price_usd;

        // Interaction: transfer the fee from the claimer to the treasury.
        let fee_charging_ix = transfer(&tx_signer.key(), &treasury.key(), fee_in_lamports);
        invoke(&fee_charging_ix, &[tx_signer, treasury])?;
    }
    Ok(())
}
