#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

// Program ID for the Sablier Lockup program.
declare_id!("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC");

/// Sablier Lockup program for creating and managing token streams.
#[program]
pub mod sablier_lockup {
    use super::*;

    // -------------------------------------------------------------------------- //
    //                         STATE-CHANGING INSTRUCTIONS                        //
    // -------------------------------------------------------------------------- //

    /// Cancels the stream and refunds any remaining tokens to the sender ATA.
    ///
    /// # Accounts Expected
    ///
    /// - `sender` The transaction signer and the stream's sender.
    /// - `deposited_token_mint` The mint of the deposited token.
    /// - `stream_nft` The NFT uniquely identifying the stream.
    /// - `deposited_token_program` The Token Program of the deposited token.
    ///
    /// # Notes
    ///
    /// - If there are any tokens left for the recipient to withdraw, the stream is marked as canceled. Otherwise, the
    /// stream is marked as depleted.
    /// - If the sender does not have an ATA for the deposited token, it is created.
    /// - Emits a [`crate::utils::events::CancelLockupStream`] event.
    ///
    /// # Requirements
    ///
    /// - The signer must be the stream's sender.
    /// - The `stream_nft` must exist.
    /// - The stream must be cancelable.
    /// - The stream must be Pending or Streaming.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        instructions::cancel::handler(ctx)
    }

    /// Collects the fees accumulated in the treasury by transferring them to the fee recipient.
    ///
    /// # Accounts Expected
    ///
    /// - `fee_collector` The transaction signer and the fee collector.
    /// - `fee_recipient` The address receiving the collected fees.
    ///
    /// # Notes
    ///
    /// - Leaves a buffer of 0.001 SOL to ensure the account remains rent-exempt after the fee collection.
    /// - Emits a [`crate::utils::events::FeesCollected`] event.
    ///
    /// # Requirements
    ///
    /// - `fee_collector` must be authorized for fee collection.
    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        instructions::collect_fees::handler(ctx)
    }

    /// Creates a stream by setting the start time to the current timestamp, and the end time to the sum of the
    /// current timestamp and the total duration. The stream is funded by the signer and wrapped in a Metaplex NFT.
    ///
    /// # Accounts Expected
    ///
    /// Refer to the accounts in [`fn@crate::sablier_lockup::create_with_timestamps_ll`].
    ///
    /// # Parameters
    ///
    /// - `salt` A unique salt used to derive the address of the stream NFT mint.
    /// - `deposit_amount` The deposit amount, denoted in units of the token's decimals.
    /// - `cliff_duration` The duration in seconds from the start time to the cliff.
    /// - `total_duration` The total duration of the stream in seconds.
    /// - `start_unlock_amount` The amount to be unlocked at the start time.
    /// - `cliff_unlock_amount` The amount to be unlocked at the cliff time.
    /// - `is_cancelable` Indicates whether the stream will be cancelable.
    ///
    /// # Notes
    ///
    /// - The start time is set to the current block timestamp.
    /// - The cliff time is calculated as `start_time + cliff_duration`.
    /// - The end time is calculated as `start_time + total_duration`.
    /// - A `cliff_duration` of zero means there is no cliff.
    /// - Refer to the notes in [`fn@crate::sablier_lockup::create_with_timestamps_ll`] for additional details.
    ///
    /// # Requirements
    ///
    /// Refer to the requirements in [`fn@crate::sablier_lockup::create_with_timestamps_ll`].
    #[allow(clippy::too_many_arguments)]
    pub fn create_with_durations_ll(
        ctx: Context<CreateWithTimestamps>,
        salt: u128,
        deposit_amount: u64,
        cliff_duration: u64,
        total_duration: u64,
        start_unlock_amount: u64,
        cliff_unlock_amount: u64,
        is_cancelable: bool,
    ) -> Result<()> {
        instructions::create_with_durations_ll::handler(
            ctx,
            salt,
            deposit_amount,
            cliff_duration,
            total_duration,
            start_unlock_amount,
            cliff_unlock_amount,
            is_cancelable,
        )
    }

    /// Creates a stream with the provided start and end times. The stream is funded by the signer and wrapped in
    /// a Metaplex NFT.
    ///
    /// # Accounts Expected
    ///
    /// - `funder` The transaction signer.
    /// - `sender` The account that will have authority to cancel or renounce the stream.
    /// - `deposit_token_mint` The mint of the tokens to be deposited.
    /// - `recipient` The address receiving the tokens, as well as the NFT owner.
    /// - `deposit_token_program` The Token Program of the deposit token.
    /// - `nft_token_program` The Token Program of the NFT.
    ///
    /// # Parameters
    ///
    /// - `salt` A unique salt used to derive the address of the stream NFT mint.
    /// - `deposit_amount` The deposit amount, denoted in units of the token's decimals.
    /// - `start_time` The Unix timestamp indicating the stream's start.
    /// - `cliff_time` The Unix timestamp indicating the stream's cliff.
    /// - `end_time` The Unix timestamp indicating the stream's end.
    /// - `start_unlock_amount` The amount to be unlocked at the start time.
    /// - `cliff_unlock_amount` The amount to be unlocked at the cliff time.
    /// - `is_cancelable` Indicates whether the stream will be cancelable.
    ///
    /// # Notes
    ///
    /// - The stream's sender does not have to be the same as its creator.
    /// - The stream recipient's role is implied solely by ownership of the stream NFT that is minted to the
    /// passed `recipient`.
    /// - A cliff time of zero means there is no cliff.
    /// - As long as the times are ordered, it is not an error for the start or cliff time to be in the past.
    /// - Emits a [`crate::utils::events::CreateLockupStream`] event.
    ///
    /// # Requirements
    ///
    /// - `deposit_amount` must be greater than zero.
    /// - `start_time` must be greater than zero and less than `end_time`.
    /// - If set, `cliff_time` must be greater than `start_time` and less than `end_time`.
    /// - The sum of `start_unlock_amount` and `cliff_unlock_amount` must be less than or equal to the deposit amount.
    /// - If `cliff_time` is not set, the `cliff_unlock_amount` amount must be zero.
    #[allow(clippy::too_many_arguments)]
    pub fn create_with_timestamps_ll(
        ctx: Context<CreateWithTimestamps>,
        salt: u128,
        deposit_amount: u64,
        start_time: u64,
        cliff_time: u64,
        end_time: u64,
        start_unlock_amount: u64,
        cliff_unlock_amount: u64,
        is_cancelable: bool,
    ) -> Result<()> {
        instructions::create_with_timestamps_ll::handler(
            ctx,
            salt,
            deposit_amount,
            start_time,
            cliff_time,
            end_time,
            start_unlock_amount,
            cliff_unlock_amount,
            is_cancelable,
        )
    }

    /// Creates a tranched stream by setting the start time to the current timestamp. The stream is funded by the
    /// signer and wrapped in a Metaplex NFT.
    ///
    /// # Accounts Expected
    ///
    /// Refer to the accounts in [`fn@crate::sablier_lockup::create_with_timestamps_ll`].
    ///
    /// # Parameters
    ///
    /// - `salt` A unique salt used to derive the address of the stream NFT mint.
    /// - `tranche_amounts` The amount for each tranche, denoted in units of the token's decimals.
    /// - `tranche_durations` The duration offset from the previous tranche for each tranche. The first duration is
    /// the offset from the stream's start time.
    /// - `is_cancelable` Indicates whether the stream will be cancelable.
    ///
    /// # Notes
    ///
    /// - The start time is set to the current block timestamp.
    /// - `tranche_amounts` and `tranche_durations` must have the same length.
    /// - Tranche timestamps are calculated by accumulating durations: `tranche[i].timestamp = tranche[i-1].timestamp +
    /// duration[i]`.
    /// - Emits a [`crate::utils::events::CreateLockupStream`] event.
    /// - Refer to the notes in [`fn@crate::sablier_lockup::create_with_timestamps_lt`] for additional details.
    ///
    /// # Requirements
    ///
    /// Refer to the requirements in [`fn@crate::sablier_lockup::create_with_timestamps_lt`].
    pub fn create_with_durations_lt(
        ctx: Context<CreateWithTimestamps>,
        salt: u128,
        tranche_amounts: Vec<u64>,
        tranche_durations: Vec<u64>,
        is_cancelable: bool,
    ) -> Result<()> {
        instructions::create_with_durations_lt::handler(ctx, salt, tranche_amounts, tranche_durations, is_cancelable)
    }

    /// Creates a tranched stream with the provided start time and tranches. The stream is funded by the signer and
    /// wrapped in a Metaplex NFT.
    ///
    /// # Accounts Expected
    ///
    /// Refer to the accounts in [`fn@crate::sablier_lockup::create_with_timestamps_ll`].
    ///
    /// # Parameters
    ///
    /// - `salt` A unique salt used to derive the address of the stream NFT mint.
    /// - `start_time` The Unix timestamp indicating the stream's start (must be < first tranche timestamp).
    /// - `tranches` Vec of tranches, each containing an amount and a timestamp.
    /// - `is_cancelable` Indicates whether the stream will be cancelable.
    ///
    /// # Notes
    ///
    /// - The stream's sender does not have to be the same as its creator.
    /// - The stream recipient's role is implied solely by ownership of the stream NFT that is minted to the
    /// passed `recipient`.
    /// - The deposit amount is calculated as the sum of all tranche amounts.
    /// - As long as the timestamps are ordered, it is not an error for the start time to be in the past.
    /// - Emits a [`crate::utils::events::CreateLockupStream`] event.
    ///
    /// # Requirements
    ///
    /// - `start_time` must be strictly less than the first tranche timestamp.
    /// - All tranche amounts must be greater than zero.
    /// - Tranches must have timestamps in strictly ascending order.
    pub fn create_with_timestamps_lt(
        ctx: Context<CreateWithTimestamps>,
        salt: u128,
        start_time: u64,
        tranches: Vec<state::lockup::Tranche>,
        is_cancelable: bool,
    ) -> Result<()> {
        instructions::create_with_timestamps_lt::handler(ctx, salt, start_time, tranches, is_cancelable)
    }

    /// Initializes the program with the provided fee collector address by creating a Metaplex NFT collection.
    ///
    /// # Accounts Expected
    ///
    /// - `initializer` The transaction signer.
    /// - `nft_token_program` The Token Program of the NFT collection.
    ///
    /// # Parameters:
    ///
    /// - `fee_collector`: The address that will have the authority to collect fees.
    /// - `chainlink_program`: The Chainlink program used to retrieve on-chain price feeds.
    /// - `chainlink_sol_usd_feed`: The account providing the SOL/USD price feed data.
    pub fn initialize(
        ctx: Context<Initialize>,
        fee_collector: Pubkey,
        chainlink_program: Pubkey,
        chainlink_sol_usd_feed: Pubkey,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, fee_collector, chainlink_program, chainlink_sol_usd_feed)
    }

    /// Removes the right of the stream's sender to cancel the stream.
    ///
    /// # Accounts Expected
    ///
    /// - `sender` The transaction signer and the stream's sender.
    /// - `stream_nft` The NFT uniquely identifying the stream.
    ///
    /// # Notes
    ///
    /// - Emits a [`crate::utils::events::RenounceLockupStream`] event.
    pub fn renounce(ctx: Context<Renounce>) -> Result<()> {
        instructions::renounce::handler(ctx)
    }

    /// Withdraws the provided amount of tokens from the stream data ATA to the provided account.
    ///
    /// # Accounts Expected
    ///
    /// - `signer` The transaction signer.
    /// - `deposited_token_mint` The mint of the deposited token.
    /// - `stream_nft_mint` The stream NFT mint uniquely identifying the stream.
    /// - `withdrawal_recipient` The address of the recipient receiving the withdrawn tokens.
    /// - `deposited_token_program` The Token Program of the deposited token.
    /// - `nft_token_program` The Token Program of the NFT.
    /// - `chainlink_program`: The Chainlink program used to retrieve on-chain price feeds.
    /// - `chainlink_sol_usd_feed`: The account providing the SOL/USD price feed data.
    ///
    /// # Parameters
    ///
    /// - `amount` The amount to withdraw, denoted in units of the token's decimals.
    ///
    /// # Notes
    ///
    /// - If the withdrawal recipient does not have an ATA for the deposited token, one is created.
    /// - Emits [`crate::utils::events::WithdrawFromLockupStream`] event.
    ///
    /// # Requirements
    ///
    /// - `stream_nft` must exist.
    /// - `withdrawal_recipient` must be the recipient if the signer is not the stream's recipient.
    /// - `amount` must be greater than zero and must not exceed the withdrawable amount.
    /// - The stream must not be Depleted.
    /// - `chainlink_program` and `chainlink_sol_usd_feed` must match the ones stored in the treasury.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }

    /// Withdraws the maximum withdrawable amount from the stream data ATA to the provided account.
    ///
    /// # Accounts Expected
    ///
    /// Refer to the accounts in [`fn@crate::sablier_lockup::withdraw`].
    ///
    /// # Notes
    ///
    /// Refer to the notes in [`fn@crate::sablier_lockup::withdraw`].
    ///
    /// # Requirements
    ///
    /// Refer to the requirements in [`fn@crate::sablier_lockup::withdraw`].
    pub fn withdraw_max(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw_max::handler(ctx)
    }

    // -------------------------------------------------------------------------- //
    //                           READ-ONLY INSTRUCTIONS                           //
    // -------------------------------------------------------------------------- //

    /// Calculates the amount that the sender would be refunded if the stream were canceled, denoted in units of the
    /// token's decimals.
    ///
    /// # Accounts Expected
    ///
    /// - `stream_nft` The NFT uniquely identifying the stream.
    ///
    /// # Requirements
    ///
    /// - The stream must exist.
    pub fn refundable_amount_of(ctx: Context<StreamView>) -> Result<u64> {
        instructions::refundable_amount_of::handler(ctx)
    }

    /// Retrieves the stream's status.
    ///
    /// # Accounts Expected
    ///
    /// - `stream_nft` The NFT uniquely identifying the stream.
    ///
    /// # Requirements
    ///
    /// - The stream must exist.
    pub fn status_of(ctx: Context<StreamView>) -> Result<StreamStatus> {
        instructions::status_of::handler(ctx)
    }

    /// Returns a flag indicating whether a stream based on the `_sender` and the `_salt` already exists.
    ///
    /// # Parameters
    ///
    /// - `_sender` The sender of the stream.
    /// - `_salt` The unique salt used to derive the stream NFT address.
    pub fn stream_exists(ctx: Context<StreamExists>, _sender: Pubkey, _salt: u128) -> Result<bool> {
        Ok(ctx.accounts.stream_nft.to_account_info().data_len() > 0)
    }

    /// Calculates the amount streamed to the recipient, denoted in units of the token's decimals.
    ///
    /// # Accounts Expected
    ///
    /// - `stream_nft` The NFT uniquely identifying the stream.
    ///
    /// # Notes
    ///
    /// - Upon cancellation of the stream, the amount streamed is calculated as the difference between the deposited
    /// amount and the refunded amount. Ultimately, when the stream becomes depleted, the streamed amount is equivalent
    /// to the total amount withdrawn.
    ///
    /// # Requirements
    ///
    /// - The stream must exist.
    pub fn streamed_amount_of(ctx: Context<StreamView>) -> Result<u64> {
        instructions::streamed_amount_of::handler(ctx)
    }

    /// Returns the treasury details.
    pub fn treasury_view(ctx: Context<TreasuryView>) -> Result<state::Treasury> {
        Ok(ctx.accounts.treasury.clone().into_inner())
    }

    /// Calculates the amount that the recipient can withdraw from the stream, denoted in units of the token's
    /// decimals.
    ///
    /// # Accounts Expected
    ///
    /// - `stream_nft` The NFT uniquely identifying the stream.
    ///
    /// # Requirements
    ///
    /// - The stream must exist.
    pub fn withdrawable_amount_of(ctx: Context<StreamView>) -> Result<u64> {
        instructions::withdrawable_amount_of::handler(ctx)
    }

    /// Calculates the withdrawal fee in lamports.
    ///
    /// # Accounts Expected:
    ///
    /// - `chainlink_program`: The Chainlink program used to retrieve on-chain price feeds.
    /// - `chainlink_sol_usd_feed`: The account providing the SOL/USD price feed data.
    pub fn withdrawal_fee_in_lamports(ctx: Context<WithdrawalFeeInLamports>) -> Result<u64> {
        instructions::withdrawal_fee_in_lamports::handler(ctx)
    }
}
