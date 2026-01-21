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

    // Get program IDs from constants (same as in types.rs)
    let nft_token_program_id: Pubkey = SPL_TOKEN_PROGRAM_ID.parse().unwrap();
    let metadata_program: Pubkey = TOKEN_METADATA_PROGRAM_ID.parse().unwrap();

    fuzz_accounts.nft_token_program.insert_with_address(nft_token_program_id);

    // Derive NFT collection ATA using the standard ATA address calculation
    let nft_collection_ata =
        trident.get_associated_token_address(&nft_collection_mint, &treasury, &nft_token_program_id);
    fuzz_accounts.nft_collection_ata.insert_with_address(nft_collection_ata);

    let nft_collection_metadata = fuzz_accounts.nft_collection_metadata.insert(
        trident,
        Some(PdaSeeds::new(&[METADATA, metadata_program.as_ref(), nft_collection_mint.as_ref()], metadata_program)),
    );

    let nft_collection_master_edition = fuzz_accounts.nft_collection_master_edition.insert(
        trident,
        Some(PdaSeeds::new(
            &[METADATA, metadata_program.as_ref(), nft_collection_mint.as_ref(), EDITION],
            metadata_program,
        )),
    );

    let nft_collection_data =
        fuzz_accounts.nft_collection_data.insert(trident, Some(PdaSeeds::new(&[NFT_COLLECTION_DATA], program_id)));

    // Create fee collector
    let fee_collector = fuzz_accounts.fee_collector.get(trident).unwrap();

    // Set chainlink accounts
    let chainlink_program: Pubkey = CHAINLINK_PROGRAM_ID.parse().unwrap();
    let chainlink_sol_usd_feed: Pubkey = CHAINLINK_SOL_USD_FEED_ID.parse().unwrap();

    // Build instruction
    let accounts = InitializeInstructionAccounts::new(
        initializer,
        treasury,
        nft_collection_data,
        nft_collection_master_edition,
        nft_collection_metadata,
        nft_collection_mint,
        nft_collection_ata,
        nft_token_program_id,
    );

    let data = InitializeInstructionData::new(fee_collector, chainlink_program, chainlink_sol_usd_feed);
    let ix = InitializeInstruction::data(data).accounts(accounts).instruction();

    let result = trident.process_transaction(&[ix], None);
    assert!(result.is_success(), "Initialize transaction failed");
}
