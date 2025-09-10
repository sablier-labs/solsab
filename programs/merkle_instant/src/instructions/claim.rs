use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    state::{Campaign, ClaimReceipt, Treasury},
    utils::{
        constants::{seeds::*, ANCHOR_DISCRIMINATOR_SIZE, CLAIM_FEE_USD},
        events,
        fee_calculation::convert_usd_fee_to_lamports,
        transfer_helper::transfer_tokens,
        validations::check_claim,
    },
};

#[derive(Accounts)]
#[instruction(index: u32)]
pub struct Claim<'info> {
    // -------------------------------------------------------------------------- //
    //                                USER ACCOUNTS                               //
    // -------------------------------------------------------------------------- //
    /// Write account: the signer of the claim who will pay the claim fee.
    #[account(mut)]
    pub claimer: Signer<'info>,

    /// Read account: the recipient of the airdrop.
    /// CHECK: This account is validated during the Merkle proof verification.
    pub recipient: UncheckedAccount<'info>,

    /// Create-if-needed account: the ATA for airdrop token owned by the recipient.
    #[account(
      init_if_needed,
      payer = claimer,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = recipient,
      associated_token::token_program = airdrop_token_program
    )]
    pub recipient_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // -------------------------------------------------------------------------- //
    //                              SABLIER ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Write account: the treasury account that will receive the claim fee.
    #[account(
      mut,
      seeds = [TREASURY],
      bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    // -------------------------------------------------------------------------- //
    //                              CAMPAIGN ACCOUNTS                             //
    // -------------------------------------------------------------------------- //
    /// Read account: the mint account of the airdrop token.
    #[account(address = campaign.airdrop_token_mint)]
    pub airdrop_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Write account: the account storing the campaign data.
    #[account(mut)]
    pub campaign: Box<Account<'info, Campaign>>,

    /// Write account: the campaign's ATA for the airdrop token.
    #[account(
      mut,
      associated_token::mint = airdrop_token_mint,
      associated_token::authority = campaign,
      associated_token::token_program = airdrop_token_program
    )]
    pub campaign_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Create account: the claim receipt.
    #[account(
      init,
      payer = claimer,
      space = ANCHOR_DISCRIMINATOR_SIZE + ClaimReceipt::INIT_SPACE,
      seeds = [
        CLAIM_RECEIPT,
        campaign.key().as_ref(),
        index.to_le_bytes().as_ref(),
      ],
      bump
    )]
    pub claim_receipt: Box<Account<'info, ClaimReceipt>>,

    // -------------------------------------------------------------------------- //
    //                              PROGRAM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the Token program of the airdrop token.
    pub airdrop_token_program: Interface<'info, TokenInterface>,

    /// Program account: the Associated Token program.
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Read account: The Chainlink program used to retrieve on-chain price feeds.
    /// CHECK: This is the Chainlink program.
    #[account(address = treasury.chainlink_program)]
    pub chainlink_program: AccountInfo<'info>,

    /// Read account: The account providing the SOL/USD price feed data.
    /// CHECK: We're reading data from this Chainlink feed.
    #[account(address = treasury.chainlink_sol_usd_feed)]
    pub chainlink_sol_usd_feed: AccountInfo<'info>,

    // -------------------------------------------------------------------------- //
    //                               SYSTEM ACCOUNTS                              //
    // -------------------------------------------------------------------------- //
    /// Program account: the System program.
    pub system_program: Program<'info, System>,
}

/// See the documentation for [`fn@crate::sablier_merkle_instant::claim`].
pub fn handler(ctx: Context<Claim>, index: u32, amount: u64, merkle_proof: Vec<[u8; 32]>) -> Result<()> {
    let campaign = ctx.accounts.campaign.clone();
    let airdrop_token_mint = ctx.accounts.airdrop_token_mint.clone();
    let claimer = ctx.accounts.claimer.clone();
    let recipient = ctx.accounts.recipient.clone();

    // Check: validate the claim.
    check_claim(
        amount,
        campaign.campaign_start_time,
        campaign.expiration_time,
        index,
        merkle_proof,
        campaign.merkle_root,
        recipient.key(),
    )?;

    ctx.accounts.campaign.claim()?;

    // Interaction: charge the claim fee.
    let fee_in_lamports = charge_claim_fee(
        ctx.accounts.chainlink_program.to_account_info(),
        ctx.accounts.chainlink_sol_usd_feed.to_account_info(),
        ctx.accounts.claimer.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
    )?;

    // Interaction: transfer tokens from the campaign's ATA to the recipient's ATA.
    transfer_tokens(
        ctx.accounts.campaign_ata.to_account_info(),
        ctx.accounts.recipient_ata.to_account_info(),
        campaign.to_account_info(),
        airdrop_token_mint.to_account_info(),
        ctx.accounts.airdrop_token_program.to_account_info(),
        amount,
        airdrop_token_mint.decimals,
        &[&[
            CAMPAIGN,
            campaign.creator.key().as_ref(),
            campaign.merkle_root.as_ref(),
            campaign.campaign_start_time.to_le_bytes().as_ref(),
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

/// Charges the claim fee in lamports.
fn charge_claim_fee<'info>(
    chainlink_program: AccountInfo<'info>,
    chainlink_sol_usd_feed: AccountInfo<'info>,
    tx_signer: AccountInfo<'info>,
    treasury: AccountInfo<'info>,
) -> Result<u64> {
    // Calculate the fee in lamports.
    let fee_in_lamports: u64 = convert_usd_fee_to_lamports(CLAIM_FEE_USD, chainlink_program, chainlink_sol_usd_feed);

    if fee_in_lamports > 0 {
        // Interaction: transfer the fee from the signer to the treasury.
        let fee_charging_ix = transfer(&tx_signer.key(), &treasury.key(), fee_in_lamports);
        invoke(&fee_charging_ix, &[tx_signer, treasury])?;
    }

    Ok(fee_in_lamports)
}
