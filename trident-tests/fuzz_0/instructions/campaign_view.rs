use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV")]
#[discriminator([188u8, 126u8, 110u8, 5u8, 183u8, 113u8, 158u8, 3u8])]
pub struct CampaignViewInstruction {
    pub accounts: CampaignViewInstructionAccounts,
    pub data: CampaignViewInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(CampaignViewInstructionData)]
#[storage(FuzzAccounts)]
pub struct CampaignViewInstructionAccounts {
    pub campaign: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct CampaignViewInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for CampaignViewInstruction {
    type IxAccounts = FuzzAccounts;
}
