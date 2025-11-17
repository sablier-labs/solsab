use crate::{fuzz_accounts::FuzzAccounts};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC")]
#[discriminator([160u8, 136u8, 114u8, 120u8, 234u8, 178u8, 146u8, 58u8])]
pub struct RefundableAmountOfInstruction {
    pub accounts: RefundableAmountOfInstructionAccounts,
    pub data: RefundableAmountOfInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(RefundableAmountOfInstructionData)]
#[storage(FuzzAccounts)]
pub struct RefundableAmountOfInstructionAccounts {
    pub stream_data: TridentAccount,

    pub stream_nft_mint: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct RefundableAmountOfInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for RefundableAmountOfInstruction {
    type IxAccounts = FuzzAccounts;
}
