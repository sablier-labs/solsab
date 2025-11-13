use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC")]
#[discriminator([241u8, 157u8, 138u8, 210u8, 8u8, 235u8, 187u8, 123u8])]
pub struct RenounceInstruction {
    pub accounts: RenounceInstructionAccounts,
    pub data: RenounceInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(RenounceInstructionData)]
#[storage(FuzzAccounts)]
pub struct RenounceInstructionAccounts {
    #[account(signer)]
    pub sender: TridentAccount,

    #[account(mut)]
    pub stream_data: TridentAccount,

    pub stream_nft_mint: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct RenounceInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for RenounceInstruction {
    type IxAccounts = FuzzAccounts;
}
