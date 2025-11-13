use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV")]
#[discriminator([24u8, 138u8, 30u8, 86u8, 92u8, 38u8, 143u8, 129u8])]
pub struct HasExpiredInstruction {
    pub accounts: HasExpiredInstructionAccounts,
    pub data: HasExpiredInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(HasExpiredInstructionData)]
#[storage(FuzzAccounts)]
pub struct HasExpiredInstructionAccounts {
    pub campaign: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct HasExpiredInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for HasExpiredInstruction {
    type IxAccounts = FuzzAccounts;
}
