use crate::{fuzz_accounts::FuzzAccounts, types::*};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV")]
#[discriminator([111u8, 131u8, 187u8, 98u8, 160u8, 193u8, 114u8, 244u8])]
pub struct CreateCampaignInstruction {
    pub accounts: CreateCampaignInstructionAccounts,
    pub data: CreateCampaignInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(CreateCampaignInstructionData)]
#[storage(FuzzAccounts)]
pub struct CreateCampaignInstructionAccounts {
    #[account(mut, signer)]
    pub creator: TridentAccount,

    pub airdrop_token_mint: TridentAccount,

    #[account(mut)]
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
pub struct CreateCampaignInstructionData {
    pub merkle_root: [u8; 32],

    pub campaign_start_time: u64,

    pub expiration_time: u64,

    pub name: String,

    pub ipfs_cid: String,

    pub aggregate_amount: u64,

    pub recipient_count: u32,
}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for CreateCampaignInstruction {
    type IxAccounts = FuzzAccounts;
}
