use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV")]
#[discriminator([111u8, 92u8, 142u8, 79u8, 33u8, 234u8, 82u8, 27u8])]
pub struct ClawbackInstruction {
    pub accounts: ClawbackInstructionAccounts,
    pub data: ClawbackInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(ClawbackInstructionData)]
#[storage(FuzzAccounts)]
pub struct ClawbackInstructionAccounts {
    #[account(mut, signer)]
    pub campaign_creator: TridentAccount,

    pub clawback_recipient: TridentAccount,

    #[account(mut)]
    pub clawback_recipient_ata: TridentAccount,

    pub airdrop_token_mint: TridentAccount,

    pub campaign: TridentAccount,

    #[account(mut)]
    pub campaign_ata: TridentAccount,

    pub airdrop_token_program: TridentAccount,

    #[account(address = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")]
    pub associated_token_program: TridentAccount,

    #[account(address = "11111111111111111111111111111111")]
    pub system_program: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct ClawbackInstructionData {
    pub amount: u64,
}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for ClawbackInstruction {
    type IxAccounts = FuzzAccounts;
}
