use crate::{fuzz_accounts::FuzzAccounts};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC")]
#[discriminator([104u8, 209u8, 104u8, 97u8, 122u8, 35u8, 165u8, 195u8])]
pub struct StreamExistsInstruction {
    pub accounts: StreamExistsInstructionAccounts,
    pub data: StreamExistsInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(StreamExistsInstructionData)]
#[storage(FuzzAccounts)]
pub struct StreamExistsInstructionAccounts {
    pub stream_nft_mint: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct StreamExistsInstructionData {
    pub _sender: TridentPubkey,

    pub _salt: u128,
}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for StreamExistsInstruction {
    type IxAccounts = FuzzAccounts;
}
