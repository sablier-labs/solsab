use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn initialize(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses) {
    let program_id = program_id();

    // Get payer
    let initializer = trident.payer().pubkey();
    fuzz_accounts.initializer.insert_with_address(initializer);

    // Derive treasury PDA
    let (treasury, _) = trident.find_program_address(&[TREASURY], &program_id);
    fuzz_accounts.treasury.insert_with_address(treasury);

    // Derive NFT collection mint PDA
    let nft_collection_mint =
        fuzz_accounts.nft_collection_mint.insert(trident, Some(PdaSeeds::new(&[NFT_COLLECTION_MINT], program_id)));

    fuzz_accounts.nft_token_program.insert_with_address(SPL_TOKEN_PROGRAM_ID);

    // Derive NFT collection ATA using the standard ATA address calculation
    let nft_collection_ata =
        trident.get_associated_token_address(&nft_collection_mint, &treasury, &SPL_TOKEN_PROGRAM_ID);
    fuzz_accounts.nft_collection_ata.insert_with_address(nft_collection_ata);

    let nft_collection_metadata = fuzz_accounts.nft_collection_metadata.insert(
        trident,
        Some(PdaSeeds::new(
            &[METADATA, TOKEN_METADATA_PROGRAM_ID.as_ref(), nft_collection_mint.as_ref()],
            TOKEN_METADATA_PROGRAM_ID,
        )),
    );

    let nft_collection_master_edition = fuzz_accounts.nft_collection_master_edition.insert(
        trident,
        Some(PdaSeeds::new(
            &[METADATA, TOKEN_METADATA_PROGRAM_ID.as_ref(), nft_collection_mint.as_ref(), EDITION],
            TOKEN_METADATA_PROGRAM_ID,
        )),
    );

    let nft_collection_data =
        fuzz_accounts.nft_collection_data.insert(trident, Some(PdaSeeds::new(&[NFT_COLLECTION_DATA], program_id)));

    // Get fee collector
    let fee_collector = fuzz_accounts.fee_collector.get(trident).unwrap();

    // Build instruction accounts
    let accounts = InitializeInstructionAccounts::new(
        initializer,
        treasury,
        nft_collection_data,
        nft_collection_master_edition,
        nft_collection_metadata,
        nft_collection_mint,
        nft_collection_ata,
        SPL_TOKEN_PROGRAM_ID,
    );

    let data = InitializeInstructionData::new(fee_collector, CHAINLINK_PROGRAM_ID, CHAINLINK_SOL_USD_FEED_ID);
    let ix = InitializeInstruction::data(data).accounts(accounts).instruction();

    let result = trident.process_transaction(&[ix], None);
    assert!(result.is_success(), "Initialize transaction failed");
}
