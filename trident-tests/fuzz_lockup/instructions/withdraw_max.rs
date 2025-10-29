use crate::{constants::TREASURY, fuzz_accounts::FuzzAccounts};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC")]
#[discriminator([32u8, 71u8, 46u8, 98u8, 105u8, 76u8, 85u8, 96u8])]
pub struct WithdrawMaxInstruction {
    pub accounts: WithdrawMaxInstructionAccounts,
    pub data: WithdrawMaxInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(WithdrawMaxInstructionData)]
#[storage(FuzzAccounts)]
pub struct WithdrawMaxInstructionAccounts {
    #[account(mut, signer)]
    pub signer: TridentAccount,

    pub stream_recipient: TridentAccount,

    pub withdrawal_recipient: TridentAccount,

    #[account(mut)]
    pub withdrawal_recipient_ata: TridentAccount,

    #[account(
      mut,
      storage::name = treasury,
      seeds = [TREASURY],
    )]
    pub treasury: TridentAccount,

    pub deposited_token_mint: TridentAccount,

    pub recipient_stream_nft_ata: TridentAccount,

    #[account(mut)]
    pub stream_data: TridentAccount,

    #[account(mut)]
    pub stream_data_ata: TridentAccount,

    pub stream_nft_mint: TridentAccount,

    #[account(address = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")]
    pub associated_token_program: TridentAccount,

    pub chainlink_program: TridentAccount,

    pub chainlink_sol_usd_feed: TridentAccount,

    pub deposited_token_program: TridentAccount,

    #[account(address = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")]
    pub nft_token_program: TridentAccount,

    #[account(address = "11111111111111111111111111111111")]
    pub system_program: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct WithdrawMaxInstructionData {}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for WithdrawMaxInstruction {
    type IxAccounts = FuzzAccounts;
}
