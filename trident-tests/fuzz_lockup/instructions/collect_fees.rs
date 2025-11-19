use crate::fuzz_accounts::FuzzAccounts;
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("8B3TuvxTSjVxZLpfvzvp9HKpomUqDsa1KEHXVo2iAfK7")]
#[discriminator([164u8, 152u8, 207u8, 99u8, 30u8, 186u8, 19u8, 182u8])]
pub struct CollectFeesInstruction {
    pub accounts: CollectFeesInstructionAccounts,
    pub data: CollectFeesInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(CollectFeesInstructionData)]
#[storage(FuzzAccounts)]
pub struct CollectFeesInstructionAccounts {
    #[account(signer)]
    pub fee_collector: TridentAccount,

    #[account(mut)]
    pub fee_recipient: TridentAccount,

    #[account(mut)]
    pub treasury: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct CollectFeesInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for CollectFeesInstruction {
    type IxAccounts = FuzzAccounts;
}
