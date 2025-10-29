use crate::{fuzz_accounts::FuzzAccounts};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC")]
#[discriminator([30u8, 195u8, 140u8, 141u8, 173u8, 123u8, 253u8, 60u8])]
pub struct WithdrawableAmountOfInstruction {
    pub accounts: WithdrawableAmountOfInstructionAccounts,
    pub data: WithdrawableAmountOfInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(WithdrawableAmountOfInstructionData)]
#[storage(FuzzAccounts)]
pub struct WithdrawableAmountOfInstructionAccounts {
    pub stream_data: TridentAccount,

    pub stream_nft_mint: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct WithdrawableAmountOfInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for WithdrawableAmountOfInstruction {
    type IxAccounts = FuzzAccounts;
}
