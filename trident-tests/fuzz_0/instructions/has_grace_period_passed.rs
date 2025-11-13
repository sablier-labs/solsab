use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV")]
#[discriminator([223u8, 150u8, 181u8, 32u8, 240u8, 136u8, 73u8, 236u8])]
pub struct HasGracePeriodPassedInstruction {
    pub accounts: HasGracePeriodPassedInstructionAccounts,
    pub data: HasGracePeriodPassedInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(HasGracePeriodPassedInstructionData)]
#[storage(FuzzAccounts)]
pub struct HasGracePeriodPassedInstructionAccounts {
    pub campaign: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct HasGracePeriodPassedInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for HasGracePeriodPassedInstruction {
    type IxAccounts = FuzzAccounts;
}
