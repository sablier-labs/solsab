#![warn(clippy::uninlined_format_args)]

use base64::{engine::general_purpose::STANDARD, Engine};
use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;
mod fuzz_accounts;
mod helpers;
mod transactions;
mod types;

use crate::{helpers::*, transactions::*, types::sablier_lockup::*};

#[derive(FuzzTestMethods)]
struct FuzzTest {
    /// Trident client for interacting with the Solana program
    trident: Trident,
    /// Storage for all account addresses used in fuzz testing
    fuzz_accounts: AccountAddresses,
}

#[flow_executor]
impl FuzzTest {
    // -------------------------------------------------------------------------- //
    //                                   SET-UP                                   //
    // -------------------------------------------------------------------------- //

    fn new() -> Self {
        Self {
            trident: Trident::default(),
            fuzz_accounts: AccountAddresses::default(),
        }
    }

    #[init]
    fn start(&mut self) {
        // Create default users
        self.create_users();

        // Create tokens and mint
        self.create_tokens();

        // Initialize the program
        initialize(&mut self.trident, &mut self.fuzz_accounts);

        // Warp to genesis time
        self.trident.warp_to_timestamp(GENESIS.try_into().unwrap());
    }

    // -------------------------------------------------------------------------- //
    //                                    FLOWS                                   //
    // -------------------------------------------------------------------------- //

    #[flow]
    fn flow_cancel(&mut self) {
        // Create a default stream
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, true);

        // There are 2 possible scenarios to cancel a stream:
        // 1. Stream is PENDING, thus the stream becomes DEPLETED.
        // 2. Stream is STREAMING, thus the stream becomes CANCELED.
        // Set 10% probability to cancel a PENDING stream
        let is_pending_stream = self.trident.random_from_range(1..100) <= 10;

        if is_pending_stream {
            // Warp before start time to keep stream in PENDING state
            let warp_time = self.trident.random_from_range(GENESIS..START_TIME - 1);
            self.trident.warp_to_timestamp(warp_time.try_into().unwrap());
        } else {
            // Warp between start and end time to put stream in STREAMING state
            let warp_time = self.trident.random_from_range(CLIFF_TIME + 1..END_TIME - 1);
            self.trident.warp_to_timestamp(warp_time.try_into().unwrap());
        }

        // Run the cancel test
        cancel(&mut self.trident, &mut self.fuzz_accounts, is_pending_stream);
    }

    #[flow]
    fn flow_create_with_durations_ll(&mut self) {
        create_with_durations_ll(&mut self.trident, &mut self.fuzz_accounts);
    }

    #[flow]
    fn flow_create_with_timestamps_ll(&mut self) {
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, false);
    }

    #[flow]
    fn flow_refundable_amount_of(&mut self) {
        // Create a non-default stream
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, false);

        let stream_data_pubkey = self.fuzz_accounts.stream_data.get(&mut self.trident).unwrap();
        let stream_nft_mint = self.fuzz_accounts.stream_nft_mint.get(&mut self.trident).unwrap();
        let stream_data = get_stream_data(&mut self.trident, &stream_data_pubkey);

        // Warp to active stream time
        self.warp_to_active_stream_time(&stream_data);

        // Build and execute view instruction
        let accounts = RefundableAmountOfInstructionAccounts::new(stream_data_pubkey, stream_nft_mint);
        let data = RefundableAmountOfInstructionData::new();
        let ix = RefundableAmountOfInstruction::data(data).accounts(accounts).instruction();
        let result = self.trident.process_transaction(&[ix], Some("RefundableAmountOf"));
        assert!(result.is_success(), "RefundableAmountOf transaction failed");

        // Get return data and compare with expected
        let actual: u64 = self.parse_return_data_from_logs(&result.logs()).expect("Failed to get return data");
        let expected = get_refundable_amount(&mut self.trident, &stream_data_pubkey);
        assert_eq!(actual, expected, "RefundableAmountOf return value mismatch: actual={actual}, expected={expected}");
    }

    #[flow]
    fn flow_streamed_amount_of(&mut self) {
        // Create a non-default stream
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, false);

        let stream_data_pubkey = self.fuzz_accounts.stream_data.get(&mut self.trident).unwrap();
        let stream_nft_mint = self.fuzz_accounts.stream_nft_mint.get(&mut self.trident).unwrap();
        let stream_data = get_stream_data(&mut self.trident, &stream_data_pubkey);

        // Warp to active stream time
        self.warp_to_active_stream_time(&stream_data);

        // Build and execute view instruction
        let accounts = StreamedAmountOfInstructionAccounts::new(stream_data_pubkey, stream_nft_mint);
        let data = StreamedAmountOfInstructionData::new();
        let ix = StreamedAmountOfInstruction::data(data).accounts(accounts).instruction();
        let result = self.trident.process_transaction(&[ix], Some("StreamedAmountOf"));
        assert!(result.is_success(), "StreamedAmountOf transaction failed");

        // Get return data and compare with expected
        let actual: u64 = self.parse_return_data_from_logs(&result.logs()).expect("Failed to get return data");
        let expected = get_streamed_amount(&mut self.trident, &stream_data_pubkey);
        assert_eq!(actual, expected, "StreamedAmountOf return value mismatch: actual={actual}, expected={expected}");
    }

    #[flow]
    fn flow_streamed_amount_of_monotonicity(&mut self) {
        // Create a non-default stream
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, false);

        let stream_data_pubkey = self.fuzz_accounts.stream_data.get(&mut self.trident).unwrap();
        let stream_nft_mint = self.fuzz_accounts.stream_nft_mint.get(&mut self.trident).unwrap();
        let stream_data = get_stream_data(&mut self.trident, &stream_data_pubkey);

        // Start from after cliff time to ensure streaming has started
        let start_time = stream_data.timestamps.cliff.max(stream_data.timestamps.start) + 1;
        let end_time = stream_data.timestamps.end;

        // Perform multiple time jumps and verify monotonicity
        let num_jumps = 5;
        let time_step = (end_time - start_time) / num_jumps;
        let mut previous_amount: u64 = 0;

        for i in 0..num_jumps {
            let warp_time = start_time + (time_step * i);
            self.trident.warp_to_timestamp(warp_time.try_into().unwrap());

            // Execute view instruction and parse return data
            let accounts = StreamedAmountOfInstructionAccounts::new(stream_data_pubkey, stream_nft_mint);
            let data = StreamedAmountOfInstructionData::new();
            let ix = StreamedAmountOfInstruction::data(data).accounts(accounts).instruction();
            let result = self.trident.process_transaction(&[ix], Some("StreamedAmountOf"));
            assert!(result.is_success(), "StreamedAmountOf transaction failed");

            // Get return data from on-chain execution
            let current_amount: u64 =
                self.parse_return_data_from_logs(&result.logs()).expect("Failed to get return data");

            // Verify monotonicity: current amount should be >= previous amount
            assert!(
                current_amount >= previous_amount,
                "StreamedAmountOf not monotonic: {current_amount} < {previous_amount} at step {i}"
            );

            previous_amount = current_amount;
        }
    }

    #[flow]
    fn flow_withdraw(&mut self) {
        let (withdrawable, withdraw_to_recipient) = self.setup_withdraw_flow();
        let withdraw_amount = self.trident.random_from_range(1..withdrawable);
        withdraw(&mut self.trident, &mut self.fuzz_accounts, withdraw_to_recipient, withdraw_amount);
    }

    #[flow]
    fn flow_withdraw_max(&mut self) {
        let (_, withdraw_to_recipient) = self.setup_withdraw_flow();
        withdraw_max(&mut self.trident, &mut self.fuzz_accounts, withdraw_to_recipient);
    }

    #[flow]
    fn flow_withdrawable_amount_of(&mut self) {
        // Create a non-default stream
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, false);

        let stream_data_pubkey = self.fuzz_accounts.stream_data.get(&mut self.trident).unwrap();
        let stream_nft_mint = self.fuzz_accounts.stream_nft_mint.get(&mut self.trident).unwrap();
        let stream_data = get_stream_data(&mut self.trident, &stream_data_pubkey);

        // Warp to active stream time
        self.warp_to_active_stream_time(&stream_data);

        // Build and execute view instruction
        let accounts = WithdrawableAmountOfInstructionAccounts::new(stream_data_pubkey, stream_nft_mint);
        let data = WithdrawableAmountOfInstructionData::new();
        let ix = WithdrawableAmountOfInstruction::data(data).accounts(accounts).instruction();
        let result = self.trident.process_transaction(&[ix], Some("WithdrawableAmountOf"));
        assert!(result.is_success(), "WithdrawableAmountOf transaction failed");

        // Get return data and compare with expected
        let actual: u64 = self.parse_return_data_from_logs(&result.logs()).expect("Failed to get return data");
        let expected = get_withdrawable_amount(&mut self.trident, &stream_data_pubkey);
        assert_eq!(
            actual, expected,
            "WithdrawableAmountOf return value mismatch: actual={actual}, expected={expected}"
        );
    }

    // -------------------------------------------------------------------------- //
    //                                   HELPERS                                  //
    // -------------------------------------------------------------------------- //

    /// Creates a new user and funds it with the default lamports balance.
    fn create_user(&mut self) -> Pubkey {
        let keypair = Keypair::new();
        let pubkey = keypair.pubkey();
        self.trident.airdrop(&pubkey, DEFAULT_LAMPORTS_BALANCE);
        pubkey
    }

    /// Creates default users (creator, recipient, sender, signer) and stores them in fuzz_accounts.
    fn create_users(&mut self) {
        let creator = self.create_user();
        self.fuzz_accounts.creator.insert_with_address(creator);

        let fee_collector = self.create_user();
        self.fuzz_accounts.fee_collector.insert_with_address(fee_collector);

        let recipient = self.create_user();
        self.fuzz_accounts.recipient.insert_with_address(recipient);

        let sender = self.create_user();
        self.fuzz_accounts.sender.insert_with_address(sender);

        let signer = self.create_user();
        self.fuzz_accounts.signer.insert_with_address(signer);
    }

    fn create_tokens(&mut self) {
        let creator = self.fuzz_accounts.creator.get(&mut self.trident).unwrap();

        // Create SPL token mint
        let deposit_token_mint = Keypair::new().pubkey();
        let mint_ix =
            self.trident.initialize_mint(&creator, &deposit_token_mint, TOKEN_DECIMALS, &creator, Some(&creator));
        self.trident.process_transaction(&mint_ix, None);

        self.fuzz_accounts.deposit_token_mint.insert_with_address(deposit_token_mint);

        // Set deposit token program to SPL Token
        let deposit_token_program: Pubkey = SPL_TOKEN_PROGRAM_ID.parse().unwrap();
        self.fuzz_accounts.deposit_token_program.insert_with_address(deposit_token_program);

        // Create creator's ATA
        let create_ata_ix = self.trident.initialize_associated_token_account(&creator, &deposit_token_mint, &creator);
        self.trident.process_transaction(&[create_ata_ix], None);
    }

    /// Common setup for withdraw and withdraw_max flows.
    /// Creates a stream, warps time, optionally cancels, and returns withdrawable amount.
    fn setup_withdraw_flow(&mut self) -> (u64, bool) {
        // 25% chance to cancel the stream first
        let should_cancel = self.trident.random_from_range(1..100) <= 25;

        // Randomly choose withdrawal scenario 50/50:
        // - true: anyone signs, tokens go to stream_recipient
        // - false: stream_recipient signs, tokens go to any address
        let withdraw_to_recipient = self.trident.random_bool();

        if should_cancel {
            // Create a default stream
            create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, true);
            let stream_data_pubkey = self.fuzz_accounts.stream_data.get(&mut self.trident).unwrap();

            // Warp to STREAMING time
            let warp_time = self.trident.random_from_range(CLIFF_TIME + 1..END_TIME - 1);
            self.trident.warp_to_timestamp(warp_time.try_into().unwrap());

            // Cancel the stream
            cancel(&mut self.trident, &mut self.fuzz_accounts, false);

            // Return withdrawable after cancel
            (get_withdrawable_amount(&mut self.trident, &stream_data_pubkey), withdraw_to_recipient)
        } else {
            // Create a non-default stream
            create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, false);

            // Get the stream data
            let stream_data_pubkey = self.fuzz_accounts.stream_data.get(&mut self.trident).unwrap();
            let stream_data = get_stream_data(&mut self.trident, &stream_data_pubkey);

            // Warp to active stream time
            self.warp_to_active_stream_time(&stream_data);

            // Check withdrawable after warp
            let mut withdrawable = get_withdrawable_amount(&mut self.trident, &stream_data_pubkey);
            if withdrawable == 0 {
                // Warp to near end time to ensure something is withdrawable
                self.trident.warp_to_timestamp((stream_data.timestamps.end - 1).try_into().unwrap());
                withdrawable = get_withdrawable_amount(&mut self.trident, &stream_data_pubkey);
            }
            (withdrawable, withdraw_to_recipient)
        }
    }

    /// Parses u64 return data from transaction logs.
    /// Looks for "Program return: <program_id> <base64_data>" and decodes the base64 data.
    /// Note: logs() returns debug-formatted Vec<String>, so we search for the pattern in the raw string.
    fn parse_return_data_from_logs(&self, logs: &str) -> Option<u64> {
        // Find "Program return:" and extract the base64 data after the program ID
        // Format in logs: "Program return: <program_id> <base64_data>"
        if let Some(start) = logs.find("Program return:") {
            let after_prefix = &logs[start + "Program return:".len()..];
            // Split by whitespace and get: program_id, base64_data
            let parts: Vec<&str> = after_prefix.split_whitespace().take(2).collect();
            if parts.len() >= 2 {
                // Remove any trailing quotes or punctuation from base64 data
                let base64_data = parts[1].trim_end_matches(['"', ',', ']']);
                if let Ok(bytes) = STANDARD.decode(base64_data) {
                    if bytes.len() >= 8 {
                        return Some(u64::from_le_bytes(bytes[..8].try_into().unwrap()));
                    }
                }
            }
        }
        None
    }

    /// Warps to a random time within the stream's active window: [start + 1, end + 2 weeks].
    /// This covers both streaming and settled statuses.
    fn warp_to_active_stream_time(&mut self, stream_data: &crate::types::StreamData) {
        const TWO_WEEKS: u64 = 14 * 24 * 60 * 60;
        let warp_time =
            self.trident.random_from_range(stream_data.timestamps.start + 1..stream_data.timestamps.end + TWO_WEEKS);
        self.trident.warp_to_timestamp(warp_time.try_into().unwrap());
    }

    // -------------------------------------------------------------------------- //
    //                                     END                                    //
    // -------------------------------------------------------------------------- //

    #[end]
    fn end(&mut self) {
        // Perform any cleanup here, this method will be executed
        // at the end of each iteration
    }
}

// -------------------------------------------------------------------------- //
//                                    MAIN                                    //
// -------------------------------------------------------------------------- //
fn main() {
    FuzzTest::fuzz(10000, 1);
}
