use crate::{fuzz_accounts::FuzzAccounts, types::*};
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
    #[account(mut, signer)]
    pub creator: TridentAccount,

    #[account(mut)]
    pub creator_ata: TridentAccount,

    pub recipient: TridentAccount,

    pub sender: TridentAccount,

    #[account(mut)]
    pub nft_collection_data: TridentAccount,

    pub nft_collection_master_edition: TridentAccount,

    #[account(mut)]
    pub nft_collection_metadata: TridentAccount,

    pub nft_collection_mint: TridentAccount,

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
}
