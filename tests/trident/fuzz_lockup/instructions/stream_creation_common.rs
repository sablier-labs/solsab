use crate::{constants::*, fuzz_accounts::FuzzAccounts};
use trident_fuzz::fuzzing::*;

/// Common data fields shared between stream creation instructions
#[derive(Debug, Clone, Default)]
pub struct CommonCreateData {
    pub salt: u128,
    pub deposit_amount: u64,
    pub start_unlock_amount: u64,
    pub cliff_unlock_amount: u64,
    pub is_cancelable: bool,
    pub use_cliff: bool,
}

/// The trait defining the accounts of a stream creation instruction
pub trait StreamCreationAccounts {
    fn get_creator(&self) -> &TridentAccount;
    fn get_creator_ata(&mut self) -> &mut TridentAccount;
    fn get_recipient(&self) -> &TridentAccount;
    fn get_sender(&self) -> &TridentAccount;
    fn get_deposit_token_mint(&self) -> &TridentAccount;
    fn get_deposit_token_program(&mut self) -> &mut TridentAccount;
    fn get_associated_token_program(&self) -> &TridentAccount;
    fn get_nft_token_program(&self) -> &TridentAccount;
    fn get_token_metadata_program(&self) -> &TridentAccount;
    fn get_stream_nft_mint(&mut self) -> &mut TridentAccount;
    fn get_recipient_stream_nft_ata(&mut self) -> &mut TridentAccount;
    fn get_stream_data(&mut self) -> &mut TridentAccount;
    fn get_stream_data_ata(&mut self) -> &mut TridentAccount;
    fn get_stream_nft_master_edition(&mut self) -> &mut TridentAccount;
    fn get_stream_nft_metadata(&mut self) -> &mut TridentAccount;
}

/// Probabilistically generate unlock amounts
pub fn generate_unlock_amounts(trident: &mut Trident, deposit_amount: u64, use_cliff: bool) -> (u64, u64) {
    // Calculate the cliff unlock amount first
    let cliff_unlock_amount = if !use_cliff {
        0
    } else {
        match trident.gen_range(0..100) {
            0..=19 => 0,                                // 20% chance: no cliff unlock
            20..=21 => deposit_amount,                  // 2% chance: full cliff unlock
            _ => trident.gen_range(1..=deposit_amount), // 60% chance: random cliff unlock
        }
    };

    // Calculate the start unlock amount taking into account the cliff unlock amount
    let remaining_after_cliff = deposit_amount.saturating_sub(cliff_unlock_amount);
    let start_unlock_amount = match trident.gen_range(0..100) {
        0..=19 => 0,                                       // 20% chance: no start unlock
        20..=21 => remaining_after_cliff,                  // 2% chance: use all remaining
        _ => trident.gen_range(0..=remaining_after_cliff), // 60% chance: random start unlock
    };

    (start_unlock_amount, cliff_unlock_amount)
}

/// Configure the common data fields of a stream creation instruction
pub fn configure_common_data(trident: &mut Trident) -> CommonCreateData {
    let deposit_amount = trident.gen_range(1..=u64::MAX);
    let use_cliff = trident.gen_range(0..2) == 1;
    let (start_unlock_amount, cliff_unlock_amount) = generate_unlock_amounts(trident, deposit_amount, use_cliff);

    CommonCreateData {
        salt: trident.gen_range(0..u128::MAX),
        deposit_amount,
        start_unlock_amount,
        cliff_unlock_amount,
        is_cancelable: trident.gen_range(0..2) == 1,
        use_cliff,
    }
}

/// Config the common accounts for a stream creation instruction
pub fn configure_accounts<T: StreamCreationAccounts>(
    accounts: &mut T,
    program_id: solana_sdk::pubkey::Pubkey,
    salt: u128,
    deposit_amount: u64,
    trident: &mut Trident,
    fuzz_accounts: &mut FuzzAccounts,
) {
    let deposit_token_mint_account_id = accounts.get_deposit_token_mint().account_id;
    let program_address = match deposit_token_mint_account_id {
        0 => "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        _ => "",
    };
    accounts.get_deposit_token_program().set_address(program_address.parse().unwrap());

    let creator_ata_balance = trident.gen_range(deposit_amount..=u64::MAX);
    let creator_ata = fuzz_accounts.creator_ata.get_or_create_token_account(
        accounts.get_creator_ata().account_id,
        trident,
        Some(PdaSeeds {
            seeds: &[
                accounts.get_creator().pubkey().as_ref(),
                accounts.get_deposit_token_program().pubkey().as_ref(),
                accounts.get_deposit_token_mint().pubkey().as_ref(),
            ],
            program_id: accounts.get_associated_token_program().pubkey(),
        }),
        accounts.get_deposit_token_mint().pubkey(),
        accounts.get_creator().pubkey(),
        creator_ata_balance,
        None,
        0u64,
        Some(accounts.get_creator().pubkey()),
    );
    accounts.get_creator_ata().set_address(creator_ata);

    let stream_nft_mint = fuzz_accounts.stream_nft_mint.get_or_create(
        accounts.get_stream_nft_mint().account_id,
        trident,
        Some(PdaSeeds {
            seeds: &[STREAM_NFT_MINT, accounts.get_sender().pubkey().as_ref(), salt.to_le_bytes().as_ref()],
            program_id,
        }),
        None,
    );
    accounts.get_stream_nft_mint().set_address(stream_nft_mint);

    let recipient_stream_nft_ata = fuzz_accounts.recipient_stream_nft_ata.get_or_create(
        accounts.get_recipient_stream_nft_ata().account_id,
        trident,
        Some(PdaSeeds {
            seeds: &[
                accounts.get_recipient().pubkey().as_ref(),
                accounts.get_nft_token_program().pubkey().as_ref(),
                accounts.get_stream_nft_mint().pubkey().as_ref(),
            ],
            program_id: accounts.get_associated_token_program().pubkey(),
        }),
        None,
    );
    accounts.get_recipient_stream_nft_ata().set_address(recipient_stream_nft_ata);

    let stream_data = fuzz_accounts.stream_data.get_or_create(
        accounts.get_stream_data().account_id,
        trident,
        Some(PdaSeeds {
            seeds: &[STREAM_DATA, accounts.get_stream_nft_mint().pubkey().as_ref()],
            program_id,
        }),
        None,
    );
    accounts.get_stream_data().set_address(stream_data);

    let stream_data_ata = fuzz_accounts.stream_data_ata.get_or_create(
        accounts.get_stream_data_ata().account_id,
        trident,
        Some(PdaSeeds {
            seeds: &[
                accounts.get_stream_data().pubkey().as_ref(),
                accounts.get_deposit_token_program().pubkey().as_ref(),
                accounts.get_deposit_token_mint().pubkey().as_ref(),
            ],
            program_id: accounts.get_associated_token_program().pubkey(),
        }),
        None,
    );
    accounts.get_stream_data_ata().set_address(stream_data_ata);

    let stream_nft_master_edition = fuzz_accounts.stream_nft_master_edition.get_or_create(
        accounts.get_stream_nft_master_edition().account_id,
        trident,
        Some(PdaSeeds {
            seeds: &[
                METADATA,
                accounts.get_token_metadata_program().pubkey().as_ref(),
                accounts.get_stream_nft_mint().pubkey().as_ref(),
                EDITION,
            ],
            program_id: accounts.get_token_metadata_program().pubkey(),
        }),
        None,
    );
    accounts.get_stream_nft_master_edition().set_address(stream_nft_master_edition);

    let stream_nft_metadata = fuzz_accounts.stream_nft_metadata.get_or_create(
        accounts.get_stream_nft_metadata().account_id,
        trident,
        Some(PdaSeeds {
            seeds: &[
                METADATA,
                accounts.get_token_metadata_program().pubkey().as_ref(),
                accounts.get_stream_nft_mint().pubkey().as_ref(),
            ],
            program_id: accounts.get_token_metadata_program().pubkey(),
        }),
        None,
    );
    accounts.get_stream_nft_metadata().set_address(stream_nft_metadata);
}
