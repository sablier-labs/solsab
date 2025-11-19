use crate::{constants::TREASURY, fuzz_accounts::FuzzAccounts};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("8B3TuvxTSjVxZLpfvzvp9HKpomUqDsa1KEHXVo2iAfK7")]
#[discriminator([183u8, 18u8, 70u8, 156u8, 148u8, 109u8, 161u8, 34u8])]
pub struct WithdrawInstruction {
    pub accounts: WithdrawInstructionAccounts,
    pub data: WithdrawInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(WithdrawInstructionData)]
#[storage(FuzzAccounts)]
pub struct WithdrawInstructionAccounts {
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
pub struct WithdrawInstructionData {
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
impl InstructionHooks for WithdrawInstruction {
    type IxAccounts = FuzzAccounts;

    fn set_accounts(&mut self, _trident: &mut Trident, _fuzz_accounts: &mut Self::IxAccounts) {}

    fn set_data(&mut self, _trident: &mut Trident, _fuzz_accounts: &mut Self::IxAccounts) {}
}
