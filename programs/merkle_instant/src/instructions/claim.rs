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

    // Interaction: charge the claim fee.
    let fee_in_lamports = charge_claim_fee(
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
        fee_in_lamports,
        index,
        recipient: recipient.key(),
    });

    Ok(())
}

// TODO: export this into a crate that'd be imported by both the lockup and merkle_instant programs.
fn charge_claim_fee<'info>(
    chainlink_program: AccountInfo<'info>,
    chainlink_sol_usd_feed: AccountInfo<'info>,
    tx_signer: AccountInfo<'info>,
    treasury: AccountInfo<'info>,
) -> Result<u64> {
    // If the USD fee is 0, skip the calculations.
    if CLAIM_FEE_USD == 0 {
        return Ok(0);
    }

    // Interactions: query the oracle price and the time at which it was updated.
    let round = match chainlink::latest_round_data(chainlink_program.clone(), chainlink_sol_usd_feed.clone()) {
        Ok(round) => round,
        Err(_) => return Ok(0), // If the oracle call fails, skip fee charging.
    };

    // If the price is not greater than 0, skip the calculations.
    if round.answer <= 0 {
        return Ok(0);
    }

    let current_timestamp: u32 = Clock::get().unwrap().unix_timestamp as u32;

    // Due to reorgs and latency issues, the oracle can have a timestamp that is in the future. In
    // this case, we ignore the price and skip fee charging.
    if current_timestamp < round.timestamp {
        return Ok(0);
    }

    // If the oracle hasn't been updated in the last 24 hours, we ignore the price and skip fee charging. This is a
    // safety check to avoid using outdated prices.
    const SECONDS_IN_24_HOURS: u32 = 86400;
    if current_timestamp - round.timestamp > SECONDS_IN_24_HOURS {
        return Ok(0);
    }

    // Interactions: query the oracle decimals.
    let oracle_decimals = match chainlink::decimals(chainlink_program.clone(), chainlink_sol_usd_feed.clone()) {
        Ok(decimals) => decimals,
        Err(_) => return Ok(0), // If the oracle call fails, skip fee charging.
    };

    let price = round.answer as u64;

    let fee_in_lamports: u64 = match oracle_decimals {
        8 => {
            // If the oracle decimals are 8, calculate the fee.
            CLAIM_FEE_USD * LAMPORTS_PER_SOL / price
        }
        decimals => {
            // Otherwise, adjust the calculation to account for the oracle decimals.
            CLAIM_FEE_USD * 10_u64.pow(10 + decimals as u32) / price
        }
    };

    // Interaction: transfer the fee from the signer to the treasury.
    let fee_charging_ix = transfer(&tx_signer.key(), &treasury.key(), fee_in_lamports);
    invoke(&fee_charging_ix, &[tx_signer, treasury])?;

    Ok(fee_in_lamports)
}
