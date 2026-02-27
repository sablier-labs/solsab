#![warn(clippy::uninlined_format_args)]

use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;
mod fuzz_accounts;
mod helpers;
mod transactions;
mod types;

use crate::{helpers::*, transactions::*};

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
        self.warp_to(GENESIS);
    }

    // -------------------------------------------------------------------------- //
    //                                    FLOWS                                   //
    // -------------------------------------------------------------------------- //

    #[flow]
    fn flow_cancel(&mut self) {
        self.select_random_token();

        // Create a default stream
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, true);

        // A stream can be canceled in the following scenarios:
        // 1. Stream is PENDING, thus the stream becomes DEPLETED.
        // 2. Stream is STREAMING, thus the stream becomes CANCELED.
        // Set 10% probability to cancel a PENDING stream
        let is_pending_stream = self.trident.random_from_range(1..100) <= 10;

        if is_pending_stream {
            // Warp before start time to keep stream in PENDING state
            let warp_time = self.trident.random_from_range(GENESIS..START_TIME - 1);
            self.warp_to(warp_time);
        } else {
            // Warp between start and end time to put stream in STREAMING state
            let warp_time = self.trident.random_from_range(CLIFF_TIME + 1..END_TIME - 1);
            self.warp_to(warp_time);
        }

        // Run the cancel test
        cancel(&mut self.trident, &mut self.fuzz_accounts, is_pending_stream);
    }

    #[flow]
    fn flow_create_with_durations_ll(&mut self) {
        self.select_random_token();
        create_with_durations_ll(&mut self.trident, &mut self.fuzz_accounts);
    }

    #[flow]
    fn flow_create_with_timestamps_ll(&mut self) {
        self.select_random_token();
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, false);
    }

    #[flow]
    fn flow_refundable_amount_of(&mut self) {
        self.select_random_token();
        let (stream_data_pubkey, stream_nft) = self.setup_view_flow();
        refundable_amount_of(&mut self.trident, &stream_data_pubkey, &stream_nft);
    }

    #[flow]
    fn flow_streamed_amount_of(&mut self) {
        self.select_random_token();
        let (stream_data_pubkey, stream_nft) = self.setup_view_flow();
        streamed_amount_of(&mut self.trident, &stream_data_pubkey, &stream_nft);
    }

    #[flow]
    fn flow_streamed_amount_of_monotonic_increase(&mut self) {
        self.select_random_token();

        // Create a non-default stream
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, false);

        let stream_data_pubkey = self.fuzz_accounts.stream_data.get(&mut self.trident).unwrap();
        let stream_nft = self.fuzz_accounts.stream_nft.get(&mut self.trident).unwrap();
        let stream_data = get_stream_data(&mut self.trident, &stream_data_pubkey);

        // Start from after cliff time to ensure streaming has started
        let (start, cliff, end, _, _) = get_linear_params(&stream_data);
        let start_time = cliff.max(start) + 1;
        let end_time = end;

        // Perform multiple time jumps and verify monotonicity
        let num_jumps = 5;
        let time_step = (end_time - start_time) / num_jumps;
        let mut previous_amount: u64 = 0;

        for i in 0..num_jumps {
            self.warp_to(start_time + (time_step * i));

            let current_amount = execute_streamed_amount_of(&mut self.trident, &stream_data_pubkey, &stream_nft);

            assert!(
                current_amount >= previous_amount,
                "StreamedAmountOf not monotonic: {current_amount} < {previous_amount} at step {i}"
            );

            previous_amount = current_amount;
        }
    }

    #[flow]
    fn flow_withdraw(&mut self) {
        self.select_random_token();
        let (withdrawable, withdraw_to_recipient) = self.setup_withdraw_flow();
        let withdraw_amount = self.trident.random_from_range(1..withdrawable);
        withdraw(&mut self.trident, &mut self.fuzz_accounts, withdraw_to_recipient, withdraw_amount);
    }

    #[flow]
    fn flow_withdraw_max(&mut self) {
        self.select_random_token();
        let (_, withdraw_to_recipient) = self.setup_withdraw_flow();
        withdraw_max(&mut self.trident, &mut self.fuzz_accounts, withdraw_to_recipient);
    }

    #[flow]
    fn flow_withdrawable_amount_of(&mut self) {
        self.select_random_token();
        let (stream_data_pubkey, stream_nft) = self.setup_view_flow();

        // Randomly (50/50) decide to perform a withdraw before checking withdrawable amount
        let withdraw_before = self.trident.random_bool();
        if withdraw_before {
            let withdrawable = get_withdrawable_amount(&mut self.trident, &stream_data_pubkey);
            // If nothing is withdrawable, warp to near end time to ensure something is withdrawable
            if withdrawable == 0 {
                let stream_data = get_stream_data(&mut self.trident, &stream_data_pubkey);
                let (_, _, end, _, _) = get_linear_params(&stream_data);
                self.warp_to(end - 1);
            }
            withdraw(&mut self.trident, &mut self.fuzz_accounts, true, withdrawable);
        }

        withdrawable_amount_of(&mut self.trident, &stream_data_pubkey, &stream_nft);
    }

    // -------------------------------------------------------------------------- //
    //                                   HELPERS                                  //
    // -------------------------------------------------------------------------- //

    /// Creates a new user and funds it with the default lamports balance.
    fn create_user(&mut self) -> Pubkey {
        let pubkey = Keypair::new().pubkey();
        self.trident.airdrop(&pubkey, DEFAULT_LAMPORTS_BALANCE);
        pubkey
    }

    /// Creates default users (funder, recipient, sender, signer) and stores them in fuzz_accounts.
    fn create_users(&mut self) {
        let funder = self.create_user();
        self.fuzz_accounts.funder.insert_with_address(funder);

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
        let funder = self.fuzz_accounts.funder.get(&mut self.trident).unwrap();
        let spl_program: Pubkey = SPL_TOKEN_PROGRAM_ID.parse().unwrap();
        let token2022_program: Pubkey = TOKEN2022_PROGRAM_ID.parse().unwrap();

        // Create SPL Token mint and funder ATA
        let spl_mint = Keypair::new().pubkey();
        let spl_mint_ix = self.trident.initialize_mint(&funder, &spl_mint, TOKEN_DECIMALS, &funder, Some(&funder));
        self.trident.process_transaction(&spl_mint_ix, None);
        self.fuzz_accounts.spl_token_mint.insert_with_address(spl_mint);
        self.fuzz_accounts.spl_token_program.insert_with_address(spl_program);

        let initialize_ata_ix = self.trident.initialize_associated_token_account(&funder, &spl_mint, &funder);
        self.trident.process_transaction(&[initialize_ata_ix], None);

        // Create Token-2022 mint and funder ATA
        let token2022_mint = Keypair::new().pubkey();
        let token2022_mint_ix =
            self.trident.initialize_mint_2022(&funder, &token2022_mint, TOKEN_DECIMALS, &funder, Some(&funder), &[]);
        self.trident.process_transaction(&token2022_mint_ix, None);
        self.fuzz_accounts.token2022_mint.insert_with_address(token2022_mint);
        self.fuzz_accounts.token2022_program.insert_with_address(token2022_program);

        let initialize_ata_2022_ix =
            self.trident.initialize_associated_token_account_2022(&funder, &token2022_mint, &funder, &[]);
        self.trident.process_transaction(&initialize_ata_2022_ix, None);
    }

    /// Randomly selects SPL Token or Token-2022 as the active deposit token for the next flow.
    fn select_random_token(&mut self) {
        let use_token_2022 = self.trident.random_bool();
        let (mint, program) = if use_token_2022 {
            (
                self.fuzz_accounts.token2022_mint.get(&mut self.trident).unwrap(),
                self.fuzz_accounts.token2022_program.get(&mut self.trident).unwrap(),
            )
        } else {
            (
                self.fuzz_accounts.spl_token_mint.get(&mut self.trident).unwrap(),
                self.fuzz_accounts.spl_token_program.get(&mut self.trident).unwrap(),
            )
        };
        self.fuzz_accounts.deposit_token_mint.insert_with_address(mint);
        self.fuzz_accounts.deposit_token_program.insert_with_address(program);
    }

    /// Common setup for view flows: creates a stream, warps to active time, returns pubkeys.
    fn setup_view_flow(&mut self) -> (Pubkey, Pubkey) {
        create_with_timestamps_ll(&mut self.trident, &mut self.fuzz_accounts, false);

        let stream_data_pubkey = self.fuzz_accounts.stream_data.get(&mut self.trident).unwrap();
        let stream_nft = self.fuzz_accounts.stream_nft.get(&mut self.trident).unwrap();
        let stream_data = get_stream_data(&mut self.trident, &stream_data_pubkey);

        self.warp_to_active_stream_time(&stream_data);

        (stream_data_pubkey, stream_nft)
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
            self.warp_to(warp_time);

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
                let (_, _, end, _, _) = get_linear_params(&stream_data);
                self.warp_to(end - 1);
                withdrawable = get_withdrawable_amount(&mut self.trident, &stream_data_pubkey);
            }
            (withdrawable, withdraw_to_recipient)
        }
    }

    fn warp_to(&mut self, timestamp: u64) {
        self.trident.warp_to_timestamp(timestamp.try_into().unwrap());
    }

    /// Warps to a random time within the stream's active window: [start + 1, end + 2 weeks].
    /// This covers both streaming and settled statuses.
    fn warp_to_active_stream_time(&mut self, stream_data: &crate::types::StreamData) {
        const TWO_WEEKS: u64 = 14 * 24 * 60 * 60;
        let (start, _, end, _, _) = get_linear_params(stream_data);
        let warp_time = self.trident.random_from_range(start + 1..end + TWO_WEEKS);
        self.warp_to(warp_time);
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
