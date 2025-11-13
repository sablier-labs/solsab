use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC")]
#[discriminator([232u8, 219u8, 223u8, 41u8, 219u8, 236u8, 220u8, 190u8])]
pub struct CancelInstruction {
    pub accounts: CancelInstructionAccounts,
    pub data: CancelInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(CancelInstructionData)]
#[storage(FuzzAccounts)]
pub struct CancelInstructionAccounts {
    #[account(mut, signer)]
    pub sender: TridentAccount,

    #[account(mut)]
    pub sender_ata: TridentAccount,

    pub deposited_token_mint: TridentAccount,

    #[account(mut)]
    pub stream_data: TridentAccount,

    #[account(mut)]
    pub stream_data_ata: TridentAccount,

    pub stream_nft_mint: TridentAccount,

    #[account(address = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")]
    pub associated_token_program: TridentAccount,

    pub deposited_token_program: TridentAccount,

    #[account(address = "11111111111111111111111111111111")]
    pub system_program: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct CancelInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for CancelInstruction {
    type IxAccounts = FuzzAccounts;
}
