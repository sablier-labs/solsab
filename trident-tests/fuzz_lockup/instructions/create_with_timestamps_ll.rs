use crate::{
    constants::*, fuzz_accounts::FuzzAccounts, get_current_time_from_trident, instructions::stream_creation_common::*,
    ONE_MONTH_SECONDS,
};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC")]
#[discriminator([150u8, 165u8, 147u8, 28u8, 68u8, 41u8, 48u8, 41u8])]
pub struct CreateWithTimestampsLlInstruction {
    pub accounts: CreateWithTimestampsLlInstructionAccounts,
    pub data: CreateWithTimestampsLlInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(CreateWithTimestampsLlInstructionData)]
#[storage(FuzzAccounts)]
pub struct CreateWithTimestampsLlInstructionAccounts {
    #[account(
      mut,
      signer,
      storage::name = creator,
      lamports = DEFAULT_LAMPORTS_BALANCE
    )]
    pub creator: TridentAccount,

    #[account(mut)]
    pub creator_ata: TridentAccount,

    #[account(
      storage::name = recipient,
      storage::account_id = (0..2))]
    pub recipient: TridentAccount,

    #[account(
      storage::name = sender,
      storage::account_id = (0..3))]
    pub sender: TridentAccount,

    #[account(
      mut,
      storage::name = nft_collection_data,
      seeds = [NFT_COLLECTION_DATA],
    )]
    pub nft_collection_data: TridentAccount,

    #[account(
      mut,
      storage::name = nft_collection_master_edition,
      seeds = [
        METADATA,
        token_metadata_program.as_ref(),
        nft_collection_mint.as_ref(),
        EDITION],
      program_id = token_metadata_program,
    )]
    pub nft_collection_master_edition: TridentAccount,

    #[account(
      mut,
      storage::name = nft_collection_metadata,
      seeds = [METADATA,
        token_metadata_program.as_ref(),
        nft_collection_mint.as_ref()],
      program_id = token_metadata_program,
    )]
    pub nft_collection_metadata: TridentAccount,

    #[account(
      mut,
      storage::name = nft_collection_mint,
      seeds = [NFT_COLLECTION_MINT],
    )]
    pub nft_collection_mint: TridentAccount,

    #[account(
      mut,
      storage::name = deposit_token_mint,
      storage::account_id = 0
    )]
    pub deposit_token_mint: TridentAccount,

    #[account(mut)]
    pub stream_nft_mint: TridentAccount,

    #[account(mut)]
    pub recipient_stream_nft_ata: TridentAccount,

    #[account(mut)]
    pub stream_data: TridentAccount,

    #[account(mut)]
    pub stream_data_ata: TridentAccount,

    #[account(mut)]
    pub stream_nft_master_edition: TridentAccount,

    #[account(mut)]
    pub stream_nft_metadata: TridentAccount,

    #[account(address = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")]
    pub associated_token_program: TridentAccount,

    pub deposit_token_program: TridentAccount,

    #[account(address = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")]
    pub nft_token_program: TridentAccount,

    #[account(address = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")]
    pub token_metadata_program: TridentAccount,

    #[account(address = "11111111111111111111111111111111")]
    pub system_program: TridentAccount,

    #[account(address = "SysvarRent111111111111111111111111111111111")]
    pub rent: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct CreateWithTimestampsLlInstructionData {
    pub salt: u128,

    pub deposit_amount: u64,

    pub start_time: u64,

    pub cliff_time: u64,

    pub end_time: u64,

    pub start_unlock_amount: u64,

    pub cliff_unlock_amount: u64,

    pub is_cancelable: bool,
}

impl StreamCreationAccounts for CreateWithTimestampsLlInstructionAccounts {
    fn get_creator(&self) -> &TridentAccount {
        &self.creator
    }

    fn get_creator_ata(&mut self) -> &mut TridentAccount {
        &mut self.creator_ata
    }

    fn get_recipient(&self) -> &TridentAccount {
        &self.recipient
    }

    fn get_sender(&self) -> &TridentAccount {
        &self.sender
    }

    fn get_deposit_token_mint(&self) -> &TridentAccount {
        &self.deposit_token_mint
    }

    fn get_deposit_token_program(&mut self) -> &mut TridentAccount {
        &mut self.deposit_token_program
    }

    fn get_associated_token_program(&self) -> &TridentAccount {
        &self.associated_token_program
    }

    fn get_nft_token_program(&self) -> &TridentAccount {
        &self.nft_token_program
    }

    fn get_token_metadata_program(&self) -> &TridentAccount {
        &self.token_metadata_program
    }

    fn get_stream_nft_mint(&mut self) -> &mut TridentAccount {
        &mut self.stream_nft_mint
    }

    fn get_recipient_stream_nft_ata(&mut self) -> &mut TridentAccount {
        &mut self.recipient_stream_nft_ata
    }

    fn get_stream_data(&mut self) -> &mut TridentAccount {
        &mut self.stream_data
    }

    fn get_stream_data_ata(&mut self) -> &mut TridentAccount {
        &mut self.stream_data_ata
    }

    fn get_stream_nft_master_edition(&mut self) -> &mut TridentAccount {
        &mut self.stream_nft_master_edition
    }

    fn get_stream_nft_metadata(&mut self) -> &mut TridentAccount {
        &mut self.stream_nft_metadata
    }
}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for CreateWithTimestampsLlInstruction {
    type IxAccounts = FuzzAccounts;

    fn set_accounts(&mut self, trident: &mut Trident, fuzz_accounts: &mut Self::IxAccounts) {
        let program_id = self.get_program_id();
        configure_accounts(
            &mut self.accounts,
            program_id,
            self.data.salt,
            self.data.deposit_amount,
            trident,
            fuzz_accounts,
        );
    }

    fn set_data(&mut self, trident: &mut Trident, _fuzz_accounts: &mut Self::IxAccounts) {
        // Generate common data
        let common_data = configure_common_data(trident);

        // Probabilistically determine the start time: past, present or future
        let now = get_current_time_from_trident(trident);
        let start_time = match trident.gen_range(0..100) {
            0..=29 => {
                // 30% chance: start time in the past (1h to 1mo ago)
                let past_offset = trident.gen_range(3600..=ONE_MONTH_SECONDS);
                now.saturating_sub(past_offset)
            }
            30..=59 => now,
            _ => {
                // 40% chance: start time in the future (1h to 6mo from now)
                let future_offset = trident.gen_range(3600..=(6 * ONE_MONTH_SECONDS));
                now.saturating_add(future_offset)
            }
        };

        let max_duration = 6 * ONE_MONTH_SECONDS;

        let cliff_time;
        let end_time;

        if common_data.use_cliff {
            // Ensure start < cliff < end
            // First, determine end_time
            end_time = if trident.gen_range(0..100) < 5 {
                start_time.saturating_add(2)
            } else {
                start_time.saturating_add(trident.gen_range(2..=max_duration))
            };

            // Place cliff between start and end
            let cliff_mode = trident.gen_range(0..100);
            cliff_time = if cliff_mode < 10 {
                // Very close to start time
                start_time.saturating_add(1)
            } else if cliff_mode > 90 {
                // Very close to end time
                end_time - 1
            } else {
                // Anywhere between the start and end times
                trident.gen_range(start_time + 1..end_time)
            };
        } else {
            // No cliff: ensure start_time < end_time
            cliff_time = 0;
            end_time = if trident.gen_range(0..100) < 5 {
                start_time.saturating_add(1)
            } else {
                start_time.saturating_add(trident.gen_range(1..=max_duration))
            };
        }

        // Initialize the Ix with common data
        self.data.salt = common_data.salt;
        self.data.deposit_amount = common_data.deposit_amount;
        self.data.start_unlock_amount = common_data.start_unlock_amount;
        self.data.cliff_unlock_amount = common_data.cliff_unlock_amount;
        self.data.is_cancelable = common_data.is_cancelable;

        // Set timestamp-specific data
        self.data.start_time = start_time;
        self.data.end_time = end_time;
        self.data.cliff_time = cliff_time;
    }
}
