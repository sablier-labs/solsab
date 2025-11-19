use crate::{constants::*, create_user_account_in_client, create_user_account_in_storage, fuzz_accounts::FuzzAccounts};
use borsh::{BorshDeserialize, BorshSerialize};
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("8B3TuvxTSjVxZLpfvzvp9HKpomUqDsa1KEHXVo2iAfK7")]
#[discriminator([175u8, 175u8, 109u8, 31u8, 13u8, 152u8, 155u8, 237u8])]
pub struct InitializeInstruction {
    pub accounts: InitializeInstructionAccounts,
    pub data: InitializeInstructionData,
}

/// Instruction Accounts
#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(InitializeInstructionData)]
#[storage(FuzzAccounts)]
pub struct InitializeInstructionAccounts {
    #[account(
      mut,
      signer,
      storage::name = initializer,
      lamports = DEFAULT_LAMPORTS_BALANCE)]
    pub initializer: TridentAccount,

    #[account(
      mut,
      storage::name = treasury,
      seeds = [TREASURY],
    )]
    pub treasury: TridentAccount,

    #[account(
      mut,
      storage::name = nft_collection_data,
      seeds = [NFT_COLLECTION_DATA],
    )]
    pub nft_collection_data: TridentAccount,

    #[account(mut)]
    pub nft_collection_master_edition: TridentAccount,

    #[account(mut)]
    pub nft_collection_metadata: TridentAccount,

    #[account(mut)]
    pub nft_collection_mint: TridentAccount,

    #[account(mut)]
    pub nft_collection_ata: TridentAccount,

    #[account(address = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")]
    pub associated_token_program: TridentAccount,

    #[account(address = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")]
    pub nft_token_program: TridentAccount,

    #[account(address = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")]
    pub token_metadata_program: TridentAccount,

    #[account(address = "SysvarRent111111111111111111111111111111111")]
    pub rent: TridentAccount,

    #[account(address = "11111111111111111111111111111111")]
    pub system_program: TridentAccount,
}

/// Instruction Data
#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct InitializeInstructionData {
    pub fee_collector: TridentPubkey,

    pub chainlink_program: TridentPubkey,

    pub chainlink_sol_usd_feed: TridentPubkey,
}

/// Implementation of instruction setters for fuzzing
///
/// Provides methods to:
/// - Set instruction data during fuzzing
/// - Configure instruction accounts during fuzzing
/// - (Optional) Set remaining accounts during fuzzing
///
/// Docs: https://ackee.xyz/trident/docs/latest/start-fuzzing/writting-fuzz-test/
impl InstructionHooks for InitializeInstruction {
    type IxAccounts = FuzzAccounts;

    fn set_accounts(&mut self, trident: &mut Trident, fuzz_accounts: &mut Self::IxAccounts) {
        let nft_collection_mint = fuzz_accounts.nft_collection_mint.get_or_create(
            self.accounts.nft_collection_mint.account_id,
            trident,
            Some(PdaSeeds {
                seeds: &[NFT_COLLECTION_MINT],
                program_id: self.get_program_id(), // TODO: why isn't this self.accounts.nft_token_program.pubkey()?
            }),
            None,
        );
        self.accounts.nft_collection_mint.set_address(nft_collection_mint);

        let nft_collection_ata = fuzz_accounts.nft_collection_ata.get_or_create(
            self.accounts.nft_collection_ata.account_id,
            trident,
            Some(PdaSeeds {
                seeds: &[
                    self.accounts.treasury.pubkey().as_ref(),
                    self.accounts.nft_token_program.pubkey().as_ref(),
                    self.accounts.nft_collection_mint.pubkey().as_ref(),
                ],
                program_id: self.accounts.associated_token_program.pubkey(),
            }),
            None,
        );
        self.accounts.nft_collection_ata.set_address(nft_collection_ata);

        let nft_collection_master_edition = fuzz_accounts.nft_collection_master_edition.get_or_create(
            self.accounts.nft_collection_master_edition.account_id,
            trident,
            Some(PdaSeeds {
                seeds: &[
                    METADATA,
                    self.accounts.token_metadata_program.pubkey().as_ref(),
                    self.accounts.nft_collection_mint.pubkey().as_ref(),
                    EDITION,
                ],
                program_id: self.accounts.token_metadata_program.pubkey(),
            }),
            None,
        );
        self.accounts.nft_collection_master_edition.set_address(nft_collection_master_edition);

        let nft_collection_metadata = fuzz_accounts.nft_collection_metadata.get_or_create(
            self.accounts.nft_collection_metadata.account_id,
            trident,
            Some(PdaSeeds {
                seeds: &[
                    METADATA,
                    self.accounts.token_metadata_program.pubkey().as_ref(),
                    self.accounts.nft_collection_mint.pubkey().as_ref(),
                ],
                program_id: self.accounts.token_metadata_program.pubkey(),
            }),
            None,
        );
        self.accounts.nft_collection_metadata.set_address(nft_collection_metadata);
    }

    fn set_data(&mut self, trident: &mut Trident, fuzz_accounts: &mut Self::IxAccounts) {
        let fee_collector = create_user_account_in_client(trident);
        create_user_account_in_storage(&mut fuzz_accounts.fee_collector, self.data.fee_collector.account_id, trident);
        self.data.fee_collector.set_pubkey(fee_collector);

        fuzz_accounts.chainlink_program.get_or_create(self.data.chainlink_program.account_id, trident, None, None);
        self.data.chainlink_program.set_pubkey(crate::constants::CHAINLINK_PROGRAM_ID.parse().unwrap());

        self.data.chainlink_sol_usd_feed.set_pubkey(crate::constants::CHAINLINK_SOL_USD_FEED_ID.parse().unwrap());
    }
}
