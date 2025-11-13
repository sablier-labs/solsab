use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV")]
#[discriminator([182u8, 195u8, 167u8, 56u8, 232u8, 3u8, 223u8, 102u8])]
pub struct HasClaimedInstruction {
    pub accounts: HasClaimedInstructionAccounts,
    pub data: HasClaimedInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(HasClaimedInstructionData)]
#[storage(FuzzAccounts)]
pub struct HasClaimedInstructionAccounts {
    pub campaign: TridentAccount,

    pub claim_receipt: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct HasClaimedInstructionData {
    pub _index: u32,
}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for HasClaimedInstruction {
    type IxAccounts = FuzzAccounts;
}
