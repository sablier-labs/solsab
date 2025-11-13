use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV")]
#[discriminator([135u8, 101u8, 171u8, 220u8, 86u8, 97u8, 104u8, 199u8])]
pub struct HasCampaignStartedInstruction {
    pub accounts: HasCampaignStartedInstructionAccounts,
    pub data: HasCampaignStartedInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(HasCampaignStartedInstructionData)]
#[storage(FuzzAccounts)]
pub struct HasCampaignStartedInstructionAccounts {
    pub campaign: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct HasCampaignStartedInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for HasCampaignStartedInstruction {
    type IxAccounts = FuzzAccounts;
}
