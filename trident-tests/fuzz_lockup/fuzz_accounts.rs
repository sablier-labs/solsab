use trident_fuzz::fuzzing::*;

/// Storage for all account addresses used in fuzz testing.
///
/// This struct serves as a centralized repository for account addresses, enabling
/// their reuse across different instruction flows and test scenarios.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-api-macro/trident-types/fuzz-accounts/
#[derive(Default)]
pub struct AccountAddresses {
    pub sender: AddressStorage,

    pub sender_ata: AddressStorage,

    pub deposited_token_mint: AddressStorage,

    pub stream_data: AddressStorage,

    pub stream_data_ata: AddressStorage,

    pub stream_nft_mint: AddressStorage,

    pub associated_token_program: AddressStorage,

    pub deposited_token_program: AddressStorage,

    pub system_program: AddressStorage,

    pub fee_collector: AddressStorage,

    pub fee_recipient: AddressStorage,

    pub treasury: AddressStorage,

    pub creator: AddressStorage,

    pub creator_ata: AddressStorage,

    pub recipient: AddressStorage,

    pub nft_collection_data: AddressStorage,

    pub nft_collection_master_edition: AddressStorage,

    pub nft_collection_metadata: AddressStorage,

    pub nft_collection_mint: AddressStorage,

    pub deposit_token_mint: AddressStorage,

    pub recipient_stream_nft_ata: AddressStorage,

    pub stream_nft_master_edition: AddressStorage,

    pub stream_nft_metadata: AddressStorage,

    pub deposit_token_program: AddressStorage,

    pub nft_token_program: AddressStorage,

    pub token_metadata_program: AddressStorage,

    pub rent: AddressStorage,

    pub initializer: AddressStorage,

    pub nft_collection_ata: AddressStorage,

    pub signer: AddressStorage,

    pub stream_recipient: AddressStorage,

    pub withdrawal_recipient: AddressStorage,

    pub withdrawal_recipient_ata: AddressStorage,

    pub chainlink_program: AddressStorage,

    pub chainlink_sol_usd_feed: AddressStorage,

    pub recipient_ata: AddressStorage,
}
