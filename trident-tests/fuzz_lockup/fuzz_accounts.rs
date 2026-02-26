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

    pub stream_data: AddressStorage,

    pub stream_data_ata: AddressStorage,

    pub stream_nft: AddressStorage,

    pub stream_nft_collection: AddressStorage,

    pub fee_collector: AddressStorage,

    pub treasury: AddressStorage,

    pub funder: AddressStorage,

    pub funder_ata: AddressStorage,

    pub recipient: AddressStorage,

    pub deposit_token_mint: AddressStorage,

    pub deposit_token_program: AddressStorage,

    pub initializer: AddressStorage,

    pub signer: AddressStorage,

    pub withdrawal_recipient_ata: AddressStorage,
}
