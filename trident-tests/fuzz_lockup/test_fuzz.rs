mod constants;
mod fuzz_accounts;
mod helpers;
mod instructions;
mod invariants;
mod stream_creation_assertions;
mod transactions;
mod types;
mod withdrawal_assertions;

use crate::{
    constants::*,
    helpers::*,
    instructions::{
        CreateWithDurationsLlInstructionAccounts, CreateWithDurationsLlInstructionData,
        CreateWithTimestampsLlInstructionAccounts, CreateWithTimestampsLlInstructionData,
    },
};
use fuzz_accounts::*;
use solana_sdk::pubkey::Pubkey;
pub use transactions::*;
use trident_fuzz::fuzzing::*;

#[derive(FuzzTestMethods)]
struct FuzzTest {
    /// for fuzzing
    trident: Trident,
    /// for storing fuzzing accounts
    fuzz_accounts: FuzzAccounts,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        Self {
            trident: Trident::default(),
            fuzz_accounts: FuzzAccounts::default(),
        }
    }

    #[init]
    fn start(&mut self) {
        let mut tx = InitializeTransaction::build(&mut self.trident, &mut self.fuzz_accounts);
        self.trident.execute_transaction(&mut tx, Some("Initialize"));

        // Create multiple token mints for fuzzing
        // Create an SPL Token mint
        let spl_token_program_id = constants::SPL_TOKEN_PROGRAM_ID.parse().unwrap();
        self.fuzz_accounts.deposit_token_mint.get_or_create_mint_account(
            0, // account_id 0
            &mut self.trident,
            Some(PdaSeeds {
                seeds: &[],
                program_id: spl_token_program_id,
            }),
            6u8, // 6 decimals
            &spl_token_program_id,
            None,
        );

        // TODO: Uncomment this when Token2022 is supported
        //
        // // Create a Token2022 mint
        // let token2022_program_id = constants::TOKEN2022_PROGRAM_ID.parse().unwrap();
        // self.fuzz_accounts.deposit_token_mint.get_or_create_mint_account(
        //     1, // account_id 1
        //     &mut self.trident,
        //     Some(PdaSeeds {
        //         seeds: &[],
        //         program_id: token2022_program_id,
        //     }),
        //     9u8, // 9 decimals
        //     &token2022_program_id,
        //     None,
        // );

        self.trident.get_client().warp_to_timestamp(GENESIS.try_into().unwrap());
    }

    #[flow]
    fn flow_withdraw(&mut self) {
        // First, create the stream we're going to cancel
        let (cwt_ix_accs, _) = self.create_with_timestamps();

        // Probabilistically cancel the stream before withdrawal (50% chance)
        let cancel_before_withdrawing = self.trident.gen_range(0..2) == 0;
        if cancel_before_withdrawing {
            self.cancel(false, &cwt_ix_accs);
        }

        // Probabilistically determine the signer type (stream recipient or unknown signer)
        let is_signer_stream_recipient = self.trident.gen_range(0..2) == 0;

        // Withdraw from the stream
        self.withdraw(is_signer_stream_recipient, cancel_before_withdrawing, &cwt_ix_accs);
    }

    #[flow]
    fn flow_withdraw_max(&mut self) {
        // First, create the stream we're going to withdraw the max amount from
        let (cwt_ix_accs, _) = self.create_with_timestamps();

        // Withdraw max from the stream
        self.withdraw_max(&cwt_ix_accs);
    }

    #[flow]
    fn flow_cancel(&mut self) {
        // First, create the stream we're going to cancel
        let (cwt_ix_accs, _) = self.create_with_timestamps();

        // Probabilistically determine the number of withdrawals (0, 1 or 2)
        let num_withdrawals = self.trident.gen_range(0..=2);

        // Perform the withdrawals
        let mut has_withdrawn = false;
        for _i in 0..num_withdrawals {
            self.withdraw(false, false, &cwt_ix_accs);
            has_withdrawn = true;
        }

        // Cancel the stream
        self.cancel(has_withdrawn, &cwt_ix_accs);
    }

    #[flow]
    fn flow_create_with_durations(&mut self) {
        self.create_with_durations();
    }

    #[flow]
    fn flow_create_with_timestamps(&mut self) {
        self.create_with_timestamps();
    }

    // #[flow]
    // fn flow_refundable_amount_of(&mut self) {
    //     self.refundable_amount_of();
    // }

    // #[flow]
    // fn flow_streamed_amount_of(&mut self) {
    //     self.streamed_amount_of();
    // }

    // #[flow]
    // fn flow_withdrawable_amount_of(&mut self) {
    //     self.withdrawable_amount_of();
    // }

    #[end]
    fn end(&mut self) {}

    fn cancel(&mut self, withdrew_before_canceling: bool, cwt_ix_accs: &CreateWithTimestampsLlInstructionAccounts) {
        // Build the Cancel Ix
        let mut cancel_tx = CancelTransaction::build(&mut self.trident, &mut self.fuzz_accounts);

        // Reference the Cancel Ix accounts
        let cancel_ix_accs = &mut cancel_tx.instruction.accounts;

        // Use the stream sender as the signer
        let signer = cwt_ix_accs.sender.pubkey();
        cancel_ix_accs.sender.set_address(signer);
        cancel_ix_accs.sender.set_is_signer();
        cancel_ix_accs.sender.set_is_writable();

        // Set the remaining accounts
        cancel_ix_accs.deposited_token_mint.set_address(cwt_ix_accs.deposit_token_mint.pubkey());
        cancel_ix_accs.stream_data.set_address(cwt_ix_accs.stream_data.pubkey());
        cancel_ix_accs.stream_data_ata.set_address(cwt_ix_accs.stream_data_ata.pubkey());
        cancel_ix_accs.stream_nft_mint.set_address(cwt_ix_accs.stream_nft_mint.pubkey());
        cancel_ix_accs.deposited_token_program.set_address(cwt_ix_accs.deposit_token_program.pubkey());

        // Generate the sender's deposited token ATA address
        let sender_ata = self.fuzz_accounts.sender_ata.get_or_create(
            cancel_ix_accs.sender_ata.account_id,
            &mut self.trident,
            Some(PdaSeeds {
                seeds: &[
                    signer.as_ref(),
                    cancel_ix_accs.deposited_token_program.pubkey().as_ref(),
                    cancel_ix_accs.deposited_token_mint.pubkey().as_ref(),
                ],
                program_id: cancel_ix_accs.associated_token_program.pubkey(),
            }),
            None, // Will be created during instruction execution
        );
        cancel_ix_accs.sender_ata.set_address(sender_ata);

        // Deserialize the actual on-chain stream data
        let stream_data = get_stream_data_from_trident(&mut self.trident, &cwt_ix_accs.stream_data.pubkey());

        // If the stream is not cancelable, skip the cancellation (so that the Tx doesn't panick)
        if !stream_data.is_cancelable {
            return;
        }

        // Determine warp time probabilistically to cover the following cases:
        // - Before start time (now..=start_time)
        // - During streaming (start_time..=end_time)
        let start_time = stream_data.timestamps.start;
        let end_time = stream_data.timestamps.end;

        // Generate a random timestamp between now and end time
        let now = get_current_time_from_trident(&mut self.trident);

        // If we're already past the end time, skip the cancellation
        if now >= end_time {
            return;
        }

        let warp_time = self.trident.gen_range(now..end_time);
        self.trident.get_client().warp_to_timestamp(warp_time.try_into().unwrap());

        // If the streamed amount is equal to the deposited amount (e.g. when cliff unlock amount == deposit amount),
        // skip the cancellation
        let streamed_amount = get_streamed_amount(
            &stream_data.timestamps,
            &stream_data.amounts,
            stream_data.is_depleted,
            stream_data.was_canceled,
            warp_time,
        );
        if streamed_amount == stream_data.amounts.deposited {
            return;
        }

        // Determine the test case label based on the warp time
        let base_label = if warp_time < start_time {
            "CancelBeforeStartTime"
        } else {
            "CancelDuringStreaming"
        };

        // If a withdrawal has happened, adjust the label
        let label = if withdrew_before_canceling {
            &[base_label, "AfterWithdrawals"].join("")
        } else {
            base_label
        };

        self.trident.execute_transaction(&mut cancel_tx, Some(label));
    }

    fn create_with_timestamps(
        &mut self,
    ) -> (CreateWithTimestampsLlInstructionAccounts, CreateWithTimestampsLlInstructionData) {
        let mut create_tx = CreateWithTimestampsLlTransaction::build(&mut self.trident, &mut self.fuzz_accounts);
        self.trident.execute_transaction(&mut create_tx, Some("CreateWithTimestampsLl"));
        (create_tx.instruction.accounts, create_tx.instruction.data)
    }

    fn create_with_durations(
        &mut self,
    ) -> (CreateWithDurationsLlInstructionAccounts, CreateWithDurationsLlInstructionData) {
        let mut create_tx = CreateWithDurationsLlTransaction::build(&mut self.trident, &mut self.fuzz_accounts);
        self.trident.execute_transaction(&mut create_tx, Some("CreateWithDurationsLl"));
        (create_tx.instruction.accounts, create_tx.instruction.data)
    }

    #[allow(dead_code)]
    fn refundable_amount_of(&mut self) {
        // First, create the stream we're going to check the refundable amount of
        let (cwt_ix_accs, _) = self.create_with_timestamps();

        // Warp to a random time
        _ = self.warp_to_a_random_future_time(&cwt_ix_accs.stream_data.pubkey());

        // Build the RefundableAmountOf transaction
        let mut refundable_tx = RefundableAmountOfTransaction::build(&mut self.trident, &mut self.fuzz_accounts);
        let refundable_ix_accs = &mut refundable_tx.instruction.accounts;

        // Set the stream data and NFT mint accounts
        refundable_ix_accs.stream_data.set_address(cwt_ix_accs.stream_data.pubkey());
        refundable_ix_accs.stream_nft_mint.set_address(cwt_ix_accs.stream_nft_mint.pubkey());

        // Execute the refundable amount of transaction
        self.trident.execute_transaction(&mut refundable_tx, Some("RefundableAmountOf"));

        // TODO: Add assertions to verify the refundable amount when Trident supports accessing the Ix Result
    }

    #[allow(dead_code)]
    fn streamed_amount_of(&mut self) {
        // First, create the stream we're going to check the streamed amount of
        let (cwt_ix_accs, _) = self.create_with_timestamps();

        // Warp to a random time
        _ = self.warp_to_a_random_future_time(&cwt_ix_accs.stream_data.pubkey());

        // Build the StreamedAmountOf transaction
        let mut streamed_tx = StreamedAmountOfTransaction::build(&mut self.trident, &mut self.fuzz_accounts);
        let streamed_ix_accs = &mut streamed_tx.instruction.accounts;

        // Set the stream data and NFT mint accounts
        streamed_ix_accs.stream_data.set_address(cwt_ix_accs.stream_data.pubkey());
        streamed_ix_accs.stream_nft_mint.set_address(cwt_ix_accs.stream_nft_mint.pubkey());

        // Execute the streamed amount of transaction
        self.trident.execute_transaction(&mut streamed_tx, Some("StreamedAmountOf"));

        // TODO: Add assertions to verify the streamed amount when Trident supports accessing the Ix Result
    }

    #[allow(dead_code)]
    fn withdrawable_amount_of(&mut self) {
        // First, create the stream we're going to check the withdrawable amount of
        let (cwt_ix_accs, _) = self.create_with_timestamps();

        // Warp to a random time
        _ = self.warp_to_a_random_future_time(&cwt_ix_accs.stream_data.pubkey());

        // Build the WithdrawableAmountOf transaction
        let mut withdrawable_tx = WithdrawableAmountOfTransaction::build(&mut self.trident, &mut self.fuzz_accounts);
        let withdrawable_ix_accs = &mut withdrawable_tx.instruction.accounts;

        // Set the stream data and NFT mint accounts
        withdrawable_ix_accs.stream_data.set_address(cwt_ix_accs.stream_data.pubkey());
        withdrawable_ix_accs.stream_nft_mint.set_address(cwt_ix_accs.stream_nft_mint.pubkey());

        // Execute the withdrawable amount of transaction
        self.trident.execute_transaction(&mut withdrawable_tx, Some("WithdrawableAmountOf"));

        // TODO: Add assertions to verify the withdrawable amount when Trident supports accessing the Ix Result
    }

    fn withdraw(
        &mut self,
        is_signer_stream_recipient: bool,
        canceled_before_withdrawing: bool,
        cwt_ix_accs: &CreateWithTimestampsLlInstructionAccounts,
    ) {
        // Build the Withdraw Ix
        let mut withdraw_tx = WithdrawTransaction::build(&mut self.trident, &mut self.fuzz_accounts);

        // Reference the Withdraw Ix accounts
        let withdraw_ix_accs = &mut withdraw_tx.instruction.accounts;

        // Determine the signer and the label based on the signer type and cancellation status
        let (signer, label) = if is_signer_stream_recipient {
            if canceled_before_withdrawing {
                (cwt_ix_accs.recipient.pubkey(), "WithdrawAfterCancel")
            } else {
                (cwt_ix_accs.recipient.pubkey(), "Withdraw")
            }
        } else if canceled_before_withdrawing {
            (create_user_account_in_client(&mut self.trident), "WithdrawUnknownSignerAfterCancel")
        } else {
            (create_user_account_in_client(&mut self.trident), "WithdrawUnknownSigner")
        };
        withdraw_ix_accs.signer.set_address(signer);
        withdraw_ix_accs.signer.set_is_signer();
        withdraw_ix_accs.signer.set_is_writable();

        withdraw_ix_accs.stream_nft_mint.set_address(cwt_ix_accs.stream_nft_mint.pubkey());
        withdraw_ix_accs.stream_recipient.set_address(cwt_ix_accs.recipient.pubkey());
        withdraw_ix_accs.deposited_token_mint.set_address(cwt_ix_accs.deposit_token_mint.pubkey());
        withdraw_ix_accs.recipient_stream_nft_ata.set_address(cwt_ix_accs.recipient_stream_nft_ata.pubkey());
        withdraw_ix_accs.stream_data.set_address(cwt_ix_accs.stream_data.pubkey());
        withdraw_ix_accs.stream_data_ata.set_address(cwt_ix_accs.stream_data_ata.pubkey());
        withdraw_ix_accs.deposited_token_program.set_address(cwt_ix_accs.deposit_token_program.pubkey());
        withdraw_ix_accs.chainlink_program.set_address(CHAINLINK_PROGRAM_ID.parse().unwrap());
        withdraw_ix_accs.chainlink_sol_usd_feed.set_address(CHAINLINK_SOL_USD_FEED_ID.parse().unwrap());

        // Determine the withdrawal_recipient based on the signer
        let withdrawal_recipient = if is_signer_stream_recipient {
            create_user_account_in_client(&mut self.trident)
        } else {
            withdraw_ix_accs.stream_recipient.pubkey()
        };

        create_user_account_in_storage(
            &mut self.fuzz_accounts.withdrawal_recipient,
            withdraw_ix_accs.withdrawal_recipient.account_id,
            &mut self.trident,
        );
        withdraw_ix_accs.withdrawal_recipient.set_address(withdrawal_recipient);

        // Get the address of the withdrawal recipient's ATA for the deposited token
        let withdrawal_recipient_ata = self.fuzz_accounts.withdrawal_recipient_ata.get_or_create(
            withdraw_ix_accs.withdrawal_recipient_ata.account_id,
            &mut self.trident,
            Some(PdaSeeds {
                seeds: &[
                    withdrawal_recipient.as_ref(),
                    withdraw_ix_accs.deposited_token_program.pubkey().as_ref(),
                    withdraw_ix_accs.deposited_token_mint.pubkey().as_ref(),
                ],
                program_id: withdraw_ix_accs.associated_token_program.pubkey(),
            }),
            None, // Will be created during instruction execution
        );
        withdraw_ix_accs.withdrawal_recipient_ata.set_address(withdrawal_recipient_ata);

        let stream_data_pubkey = &cwt_ix_accs.stream_data.pubkey();

        // Warp to a random time
        let warp_time = self.warp_to_a_random_future_time(stream_data_pubkey);
        let stream_data = get_stream_data_from_trident(&mut self.trident, stream_data_pubkey);

        let withdrawable_amount = get_withdrawable_amount(
            &stream_data.timestamps,
            &stream_data.amounts,
            stream_data.is_depleted,
            stream_data.was_canceled,
            warp_time,
        );

        // Fuzz the withdrawal amount
        withdraw_tx.instruction.data.amount = self.trident.gen_range(1..=withdrawable_amount);

        // Execute the withdraw transaction
        self.trident.execute_transaction(&mut withdraw_tx, Some(label));
    }

    fn withdraw_max(&mut self, cwt_ix_accs: &CreateWithTimestampsLlInstructionAccounts) {
        // Build the WithdrawMax Ix
        let mut withdraw_max_tx = WithdrawMaxTransaction::build(&mut self.trident, &mut self.fuzz_accounts);

        // Reference the WithdrawMax Ix accounts
        let withdraw_max_ix_accs = &mut withdraw_max_tx.instruction.accounts;

        // Use the stream recipient as the signer
        let signer = cwt_ix_accs.recipient.pubkey();
        withdraw_max_ix_accs.signer.set_address(signer);
        withdraw_max_ix_accs.signer.set_is_signer();
        withdraw_max_ix_accs.signer.set_is_writable();

        withdraw_max_ix_accs.stream_nft_mint.set_address(cwt_ix_accs.stream_nft_mint.pubkey());
        withdraw_max_ix_accs.stream_recipient.set_address(cwt_ix_accs.recipient.pubkey());
        withdraw_max_ix_accs.deposited_token_mint.set_address(cwt_ix_accs.deposit_token_mint.pubkey());
        withdraw_max_ix_accs.recipient_stream_nft_ata.set_address(cwt_ix_accs.recipient_stream_nft_ata.pubkey());
        withdraw_max_ix_accs.stream_data.set_address(cwt_ix_accs.stream_data.pubkey());
        withdraw_max_ix_accs.stream_data_ata.set_address(cwt_ix_accs.stream_data_ata.pubkey());
        withdraw_max_ix_accs.deposited_token_program.set_address(cwt_ix_accs.deposit_token_program.pubkey());
        withdraw_max_ix_accs.chainlink_program.set_address(CHAINLINK_PROGRAM_ID.parse().unwrap());
        withdraw_max_ix_accs.chainlink_sol_usd_feed.set_address(CHAINLINK_SOL_USD_FEED_ID.parse().unwrap());

        // Create a withdrawal recipient
        let withdrawal_recipient = create_user_account_in_client(&mut self.trident);

        create_user_account_in_storage(
            &mut self.fuzz_accounts.withdrawal_recipient,
            withdraw_max_ix_accs.withdrawal_recipient.account_id,
            &mut self.trident,
        );
        withdraw_max_ix_accs.withdrawal_recipient.set_address(withdrawal_recipient);

        // Get the address of the withdrawal recipient's ATA for the deposited token
        let withdrawal_recipient_ata = self.fuzz_accounts.withdrawal_recipient_ata.get_or_create(
            withdraw_max_ix_accs.withdrawal_recipient_ata.account_id,
            &mut self.trident,
            Some(PdaSeeds {
                seeds: &[
                    withdrawal_recipient.as_ref(),
                    withdraw_max_ix_accs.deposited_token_program.pubkey().as_ref(),
                    withdraw_max_ix_accs.deposited_token_mint.pubkey().as_ref(),
                ],
                program_id: withdraw_max_ix_accs.associated_token_program.pubkey(),
            }),
            None, // Will be created during instruction execution
        );
        withdraw_max_ix_accs.withdrawal_recipient_ata.set_address(withdrawal_recipient_ata);

        // Warp to a random time
        _ = self.warp_to_a_random_future_time(&cwt_ix_accs.stream_data.pubkey());

        // Execute the withdraw max transaction
        self.trident.execute_transaction(&mut withdraw_max_tx, Some("WithdrawMax"));
    }

    /// Warps to a random timestamp between now and 2x the total stream duration
    fn warp_to_a_random_future_time(&mut self, stream_data_pubkey: &Pubkey) -> u64 {
        // Get the stream data
        let stream_data = get_stream_data_from_trident(&mut self.trident, stream_data_pubkey);

        // Generate a random time jump between now and 2x the total stream duration
        let now = get_current_time_from_trident(&mut self.trident);
        let start_time = stream_data.timestamps.start;
        let end_time = stream_data.timestamps.end;
        let total_duration = end_time - start_time;

        // Warp to a random timestamp between now and end + one month in seconds
        let mut warp_time = self.trident.gen_range(now..=now + total_duration + ONE_MONTH_SECONDS);

        let withdrawable_amount = get_withdrawable_amount(
            &stream_data.timestamps,
            &stream_data.amounts,
            stream_data.is_depleted,
            stream_data.was_canceled,
            warp_time,
        );

        // If the withdrawable amount is zero, set warp_time to end_time - 1
        if withdrawable_amount == 0 {
            warp_time = end_time - 1;
        }

        self.trident.get_client().warp_to_timestamp(warp_time as i64);

        warp_time
    }
}

fn main() {
    FuzzTest::fuzz(10000, 1);
}
