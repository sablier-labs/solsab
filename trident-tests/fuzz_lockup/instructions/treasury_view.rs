use crate::{fuzz_accounts::FuzzAccounts};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("8B3TuvxTSjVxZLpfvzvp9HKpomUqDsa1KEHXVo2iAfK7")]
#[discriminator([247u8, 160u8, 213u8, 237u8, 247u8, 121u8, 164u8, 82u8])]
pub struct TreasuryViewInstruction {
    pub accounts: TreasuryViewInstructionAccounts,
    pub data: TreasuryViewInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(TreasuryViewInstructionData)]
#[storage(FuzzAccounts)]
pub struct TreasuryViewInstructionAccounts {
    pub treasury: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct TreasuryViewInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for TreasuryViewInstruction {
    type IxAccounts = FuzzAccounts;
}
