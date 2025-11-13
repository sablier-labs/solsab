use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV")]
#[discriminator([62u8, 198u8, 214u8, 193u8, 213u8, 159u8, 108u8, 210u8])]
pub struct ClaimInstruction {
    pub accounts: ClaimInstructionAccounts,
    pub data: ClaimInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(ClaimInstructionData)]
#[storage(FuzzAccounts)]
pub struct ClaimInstructionAccounts {
    #[account(mut, signer)]
    pub claimer: TridentAccount,

    pub recipient: TridentAccount,

    #[account(mut)]
    pub recipient_ata: TridentAccount,

    #[account(mut)]
    pub treasury: TridentAccount,

    pub airdrop_token_mint: TridentAccount,

    #[account(mut)]
    pub campaign: TridentAccount,

    #[account(mut)]
    pub campaign_ata: TridentAccount,

    #[account(mut)]
    pub claim_receipt: TridentAccount,

    pub airdrop_token_program: TridentAccount,

    #[account(address = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")]
    pub associated_token_program: TridentAccount,

    pub chainlink_program: TridentAccount,

    pub chainlink_sol_usd_feed: TridentAccount,

    #[account(address = "11111111111111111111111111111111")]
    pub system_program: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct ClaimInstructionData {
    pub index: u32,

    pub amount: u64,

    pub merkle_proof: Vec<[u8; 32]>,
}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for ClaimInstruction {
    type IxAccounts = FuzzAccounts;
}
