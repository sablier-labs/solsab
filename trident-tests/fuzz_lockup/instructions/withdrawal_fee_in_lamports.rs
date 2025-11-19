use crate::{fuzz_accounts::FuzzAccounts};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("8B3TuvxTSjVxZLpfvzvp9HKpomUqDsa1KEHXVo2iAfK7")]
#[discriminator([55u8, 255u8, 88u8, 224u8, 223u8, 23u8, 97u8, 140u8])]
pub struct WithdrawalFeeInLamportsInstruction {
    pub accounts: WithdrawalFeeInLamportsInstructionAccounts,
    pub data: WithdrawalFeeInLamportsInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(WithdrawalFeeInLamportsInstructionData)]
#[storage(FuzzAccounts)]
pub struct WithdrawalFeeInLamportsInstructionAccounts {
    pub treasury: TridentAccount,

    pub chainlink_program: TridentAccount,

    pub chainlink_sol_usd_feed: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct WithdrawalFeeInLamportsInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for WithdrawalFeeInLamportsInstruction {
    type IxAccounts = FuzzAccounts;
}
