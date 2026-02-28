use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::sablier_lockup::*};
use trident_fuzz::fuzzing::*;

pub fn initialize(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses) {
    let program_id = program_id();

    // Prepare instruction accounts
    let initializer = trident.payer().pubkey();
    fuzz_accounts.initializer.insert_with_address(initializer);
    let (treasury, _) = trident.find_program_address(&[TREASURY], &program_id);
    fuzz_accounts.treasury.insert_with_address(treasury);
    let stream_nft_collection =
        fuzz_accounts.stream_nft_collection.insert(trident, Some(PdaSeeds::new(&[STREAM_NFT_COLLECTION], program_id)));
    let fee_collector = fuzz_accounts.fee_collector.get(trident).unwrap();
    let chainlink_program: Pubkey = CHAINLINK_PROGRAM_ID.parse().unwrap();
    let chainlink_sol_usd_feed: Pubkey = CHAINLINK_SOL_USD_FEED_ID.parse().unwrap();

    let accounts = InitializeInstructionAccounts::new(initializer, treasury, stream_nft_collection);
    let data = InitializeInstructionData::new(fee_collector, chainlink_program, chainlink_sol_usd_feed);
    let ix = InitializeInstruction::data(data).accounts(accounts).instruction();

    // Execute the ix
    let result = trident.process_transaction(&[ix], Some("Initialize"));
    assert!(result.is_success(), "Initialize transaction failed");
}
