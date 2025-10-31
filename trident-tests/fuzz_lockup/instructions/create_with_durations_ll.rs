use crate::{constants::*, fuzz_accounts::FuzzAccounts, instructions::stream_creation_common::*, ONE_MONTH_SECONDS};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC")]
#[discriminator([87u8, 17u8, 170u8, 167u8, 156u8, 152u8, 169u8, 61u8])]
pub struct CreateWithDurationsLlInstruction {
    pub accounts: CreateWithDurationsLlInstructionAccounts,
    pub data: CreateWithDurationsLlInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(CreateWithDurationsLlInstructionData)]
#[storage(FuzzAccounts)]
pub struct CreateWithDurationsLlInstructionAccounts {
    #[account(mut, signer, storage::name = creator, lamports = DEFAULT_LAMPORTS_BALANCE)]
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
pub struct CreateWithDurationsLlInstructionData {
    pub salt: u128,

    pub deposit_amount: u64,

    pub cliff_duration: u64,

    pub total_duration: u64,

    pub start_unlock_amount: u64,

    pub cliff_unlock_amount: u64,

    pub is_cancelable: bool,
}

impl StreamCreationAccounts for CreateWithDurationsLlInstructionAccounts {
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
impl InstructionHooks for CreateWithDurationsLlInstruction {
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

        // Generate durations
        let max_duration = 6 * ONE_MONTH_SECONDS;

        let cliff_duration;
        let total_duration;

        if common_data.use_cliff {
            // First, determine total duration
            total_duration = if trident.gen_range(0..100) < 5 {
                5 // A very short duration
            } else {
                trident.gen_range(5..=max_duration)
            };

            // Place cliff duration between 0 and total duration
            let cliff_mode = trident.gen_range(0..100);
            cliff_duration = if cliff_mode < 10 {
                // Very short cliff (1 second)
                1
            } else if cliff_mode > 90 {
                // Very close to total duration
                total_duration.saturating_sub(1)
            } else {
                // Anywhere between 0 and total duration
                trident.gen_range(1..total_duration)
            };
        } else {
            // No cliff: cliff_duration = 0
            cliff_duration = 0;
            total_duration = if trident.gen_range(0..100) < 5 {
                1 // Very short duration
            } else {
                trident.gen_range(1..=max_duration)
            };
        }

        // Initialize the Ix with common data
        self.data.salt = common_data.salt;
        self.data.deposit_amount = common_data.deposit_amount;
        self.data.start_unlock_amount = common_data.start_unlock_amount;
        self.data.cliff_unlock_amount = common_data.cliff_unlock_amount;
        self.data.is_cancelable = common_data.is_cancelable;

        // Set duration-specific data
        self.data.cliff_duration = cliff_duration;
        self.data.total_duration = total_duration;
    }
}
