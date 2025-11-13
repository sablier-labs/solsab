use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC")]
#[discriminator([91u8, 69u8, 219u8, 48u8, 189u8, 26u8, 13u8, 33u8])]
pub struct StreamedAmountOfInstruction {
    pub accounts: StreamedAmountOfInstructionAccounts,
    pub data: StreamedAmountOfInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(StreamedAmountOfInstructionData)]
#[storage(FuzzAccounts)]
pub struct StreamedAmountOfInstructionAccounts {
    pub stream_data: TridentAccount,

    pub stream_nft_mint: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct StreamedAmountOfInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for StreamedAmountOfInstruction {
    type IxAccounts = FuzzAccounts;
}
