use crate::{fuzz_accounts::FuzzAccounts};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("8B3TuvxTSjVxZLpfvzvp9HKpomUqDsa1KEHXVo2iAfK7")]
#[discriminator([90u8, 214u8, 253u8, 237u8, 126u8, 236u8, 132u8, 237u8])]
pub struct StatusOfInstruction {
    pub accounts: StatusOfInstructionAccounts,
    pub data: StatusOfInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(StatusOfInstructionData)]
#[storage(FuzzAccounts)]
pub struct StatusOfInstructionAccounts {
    pub stream_data: TridentAccount,

    pub stream_nft_mint: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct StatusOfInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for StatusOfInstruction {
    type IxAccounts = FuzzAccounts;
}
