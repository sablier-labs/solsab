use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV")]
#[discriminator([255u8, 199u8, 146u8, 222u8, 145u8, 180u8, 58u8, 231u8])]
pub struct ClaimFeeInLamportsInstruction {
    pub accounts: ClaimFeeInLamportsInstructionAccounts,
    pub data: ClaimFeeInLamportsInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(ClaimFeeInLamportsInstructionData)]
#[storage(FuzzAccounts)]
pub struct ClaimFeeInLamportsInstructionAccounts {
    pub treasury: TridentAccount,

    pub chainlink_program: TridentAccount,

    pub chainlink_sol_usd_feed: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct ClaimFeeInLamportsInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for ClaimFeeInLamportsInstruction {
    type IxAccounts = FuzzAccounts;
}
