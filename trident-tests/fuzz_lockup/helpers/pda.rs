use crate::fuzz_accounts::AccountAddresses;
use crate::helpers::*;
use crate::types::sablier_lockup::*;
use trident_fuzz::fuzzing::*;

// =============================================================================
// CREATE STREAM ACCOUNTS
// =============================================================================

/// All accounts needed for stream creation instructions.
/// Used by both `create_with_timestamps_ll` and `create_with_durations_ll`.
pub struct CreateStreamAccounts {
    pub creator: Pubkey,
    pub creator_ata: Pubkey,
    pub recipient: Pubkey,
    pub sender: Pubkey,
    pub nft_collection_data: Pubkey,
    pub nft_collection_master_edition: Pubkey,
    pub nft_collection_metadata: Pubkey,
    pub nft_collection_mint: Pubkey,
    pub deposit_token_mint: Pubkey,
    pub deposit_token_program: Pubkey,
    pub nft_token_program: Pubkey,
    pub stream_nft_mint: Pubkey,
    pub recipient_stream_nft_ata: Pubkey,
    pub stream_data: Pubkey,
    pub stream_data_ata: Pubkey,
    pub stream_nft_master_edition: Pubkey,
    pub stream_nft_metadata: Pubkey,
}

impl CreateStreamAccounts {
    /// Resolves all accounts required for stream creation.
    pub fn resolve(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses, salt: u128) -> Self {
        let program_id = program_id();

        // Get user accounts
        let creator = fuzz_accounts.creator.get(trident).unwrap();
        let recipient = fuzz_accounts.recipient.get(trident).unwrap();
        let sender = fuzz_accounts.sender.get(trident).unwrap();

        // Get token accounts
        let deposit_token_mint = fuzz_accounts.deposit_token_mint.get(trident).unwrap();
        let deposit_token_program = fuzz_accounts.deposit_token_program.get(trident).unwrap();
        let nft_token_program = fuzz_accounts.nft_token_program.get(trident).unwrap();

        // Get NFT collection accounts
        let nft_collection_data = fuzz_accounts.nft_collection_data.get(trident).unwrap();
        let nft_collection_master_edition = fuzz_accounts.nft_collection_master_edition.get(trident).unwrap();
        let nft_collection_metadata = fuzz_accounts.nft_collection_metadata.get(trident).unwrap();
        let nft_collection_mint = fuzz_accounts.nft_collection_mint.get(trident).unwrap();

        // Derive creator ATA
        let creator_ata = fuzz_accounts.creator_ata.insert(
            trident,
            Some(PdaSeeds::new(
                &[creator.as_ref(), deposit_token_program.as_ref(), deposit_token_mint.as_ref()],
                ASSOCIATED_TOKEN_PROGRAM_ID,
            )),
        );

        // Derive stream NFT mint PDA
        let stream_nft_mint = fuzz_accounts.stream_nft_mint.insert(
            trident,
            Some(PdaSeeds::new(&[STREAM_NFT_MINT, sender.as_ref(), &salt.to_le_bytes()], program_id)),
        );

        // Derive recipient stream NFT ATA
        let recipient_stream_nft_ata = fuzz_accounts.recipient_stream_nft_ata.insert(
            trident,
            Some(PdaSeeds::new(
                &[recipient.as_ref(), nft_token_program.as_ref(), stream_nft_mint.as_ref()],
                ASSOCIATED_TOKEN_PROGRAM_ID,
            )),
        );

        // Derive stream data PDA
        let stream_data = fuzz_accounts
            .stream_data
            .insert(trident, Some(PdaSeeds::new(&[STREAM_DATA, stream_nft_mint.as_ref()], program_id)));

        // Derive stream data ATA
        let stream_data_ata = fuzz_accounts.stream_data_ata.insert(
            trident,
            Some(PdaSeeds::new(
                &[stream_data.as_ref(), deposit_token_program.as_ref(), deposit_token_mint.as_ref()],
                ASSOCIATED_TOKEN_PROGRAM_ID,
            )),
        );

        // Derive stream NFT master edition
        let stream_nft_master_edition = fuzz_accounts.stream_nft_master_edition.insert(
            trident,
            Some(PdaSeeds::new(
                &[METADATA, TOKEN_METADATA_PROGRAM_ID.as_ref(), stream_nft_mint.as_ref(), EDITION],
                TOKEN_METADATA_PROGRAM_ID,
            )),
        );

        // Derive stream NFT metadata
        let stream_nft_metadata = fuzz_accounts.stream_nft_metadata.insert(
            trident,
            Some(PdaSeeds::new(
                &[METADATA, TOKEN_METADATA_PROGRAM_ID.as_ref(), stream_nft_mint.as_ref()],
                TOKEN_METADATA_PROGRAM_ID,
            )),
        );

        Self {
            creator,
            creator_ata,
            recipient,
            sender,
            nft_collection_data,
            nft_collection_master_edition,
            nft_collection_metadata,
            nft_collection_mint,
            deposit_token_mint,
            deposit_token_program,
            nft_token_program,
            stream_nft_mint,
            recipient_stream_nft_ata,
            stream_data,
            stream_data_ata,
            stream_nft_master_edition,
            stream_nft_metadata,
        }
    }

    /// Converts to `CreateWithTimestampsLlInstructionAccounts`.
    pub fn to_timestamps_accounts(&self) -> CreateWithTimestampsLlInstructionAccounts {
        CreateWithTimestampsLlInstructionAccounts::new(
            self.creator,
            self.creator_ata,
            self.recipient,
            self.sender,
            self.nft_collection_data,
            self.nft_collection_master_edition,
            self.nft_collection_metadata,
            self.nft_collection_mint,
            self.deposit_token_mint,
            self.stream_nft_mint,
            self.recipient_stream_nft_ata,
            self.stream_data,
            self.stream_data_ata,
            self.stream_nft_master_edition,
            self.stream_nft_metadata,
            self.deposit_token_program,
            self.nft_token_program,
        )
    }

    /// Converts to `CreateWithDurationsLlInstructionAccounts`.
    pub fn to_durations_accounts(&self) -> CreateWithDurationsLlInstructionAccounts {
        CreateWithDurationsLlInstructionAccounts::new(
            self.creator,
            self.creator_ata,
            self.recipient,
            self.sender,
            self.nft_collection_data,
            self.nft_collection_master_edition,
            self.nft_collection_metadata,
            self.nft_collection_mint,
            self.deposit_token_mint,
            self.stream_nft_mint,
            self.recipient_stream_nft_ata,
            self.stream_data,
            self.stream_data_ata,
            self.stream_nft_master_edition,
            self.stream_nft_metadata,
            self.deposit_token_program,
            self.nft_token_program,
        )
    }
}

// =============================================================================
// WITHDRAWAL ACCOUNTS
// =============================================================================

/// All accounts needed for withdrawal instructions.
/// Used by both `withdraw` and `withdraw_max`.
pub struct WithdrawalAccounts {
    pub signer: Pubkey,
    pub stream_recipient: Pubkey,
    pub withdrawal_recipient: Pubkey,
    pub withdrawal_recipient_ata: Pubkey,
    pub treasury: Pubkey,
    pub deposited_token_mint: Pubkey,
    pub deposited_token_program: Pubkey,
    pub nft_token_program: Pubkey,
    pub recipient_stream_nft_ata: Pubkey,
    pub stream_data: Pubkey,
    pub stream_data_ata: Pubkey,
    pub stream_nft_mint: Pubkey,
}

impl WithdrawalAccounts {
    /// Resolves all accounts required for withdrawal instructions.
    pub fn resolve(
        trident: &mut Trident,
        fuzz_accounts: &mut AccountAddresses,
        withdraw_to_recipient: bool,
    ) -> Self {
        // Get stream recipient (owner of the stream NFT)
        let stream_recipient = fuzz_accounts.recipient.get(trident).unwrap();

        // Determine signer and withdrawal_recipient based on scenario
        let (signer, withdrawal_recipient) = if withdraw_to_recipient {
            // Anyone can sign, tokens go to stream_recipient
            let signer = fuzz_accounts.signer.get(trident).unwrap();
            (signer, stream_recipient)
        } else {
            // Stream recipient must sign, tokens can go to any address
            let random_recipient = trident.payer().pubkey();
            (stream_recipient, random_recipient)
        };

        // Get token accounts
        let deposited_token_mint = fuzz_accounts.deposit_token_mint.get(trident).unwrap();
        let deposited_token_program = fuzz_accounts.deposit_token_program.get(trident).unwrap();
        let nft_token_program = fuzz_accounts.nft_token_program.get(trident).unwrap();

        // Get treasury
        let treasury = fuzz_accounts.treasury.get(trident).unwrap();

        // Get stream accounts
        let stream_nft_mint = fuzz_accounts.stream_nft_mint.get(trident).unwrap();
        let stream_data = fuzz_accounts.stream_data.get(trident).unwrap();
        let recipient_stream_nft_ata = fuzz_accounts.recipient_stream_nft_ata.get(trident).unwrap();
        let stream_data_ata = fuzz_accounts.stream_data_ata.get(trident).unwrap();

        // Derive withdrawal recipient ATA (init_if_needed in the instruction)
        let withdrawal_recipient_ata = fuzz_accounts.withdrawal_recipient_ata.insert(
            trident,
            Some(PdaSeeds::new(
                &[withdrawal_recipient.as_ref(), deposited_token_program.as_ref(), deposited_token_mint.as_ref()],
                ASSOCIATED_TOKEN_PROGRAM_ID,
            )),
        );

        Self {
            signer,
            stream_recipient,
            withdrawal_recipient,
            withdrawal_recipient_ata,
            treasury,
            deposited_token_mint,
            deposited_token_program,
            nft_token_program,
            recipient_stream_nft_ata,
            stream_data,
            stream_data_ata,
            stream_nft_mint,
        }
    }

    /// Converts to `WithdrawInstructionAccounts`.
    pub fn to_withdraw_accounts(&self) -> WithdrawInstructionAccounts {
        WithdrawInstructionAccounts::new(
            self.signer,
            self.stream_recipient,
            self.withdrawal_recipient,
            self.withdrawal_recipient_ata,
            self.treasury,
            self.deposited_token_mint,
            self.recipient_stream_nft_ata,
            self.stream_data,
            self.stream_data_ata,
            self.stream_nft_mint,
            CHAINLINK_PROGRAM_ID,
            CHAINLINK_SOL_USD_FEED_ID,
            self.deposited_token_program,
            self.nft_token_program,
        )
    }

    /// Converts to `WithdrawMaxInstructionAccounts`.
    pub fn to_withdraw_max_accounts(&self) -> WithdrawMaxInstructionAccounts {
        WithdrawMaxInstructionAccounts::new(
            self.signer,
            self.stream_recipient,
            self.withdrawal_recipient,
            self.withdrawal_recipient_ata,
            self.treasury,
            self.deposited_token_mint,
            self.recipient_stream_nft_ata,
            self.stream_data,
            self.stream_data_ata,
            self.stream_nft_mint,
            CHAINLINK_PROGRAM_ID,
            CHAINLINK_SOL_USD_FEED_ID,
            self.deposited_token_program,
            self.nft_token_program,
        )
    }
}
