use trident_fuzz::fuzzing::*;

/// FuzzAccounts contains all available accounts
///
/// You can create your own accounts by adding new fields to the struct.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-api-macro/trident-types/fuzz-accounts/
#[derive(Default)]
pub struct FuzzAccounts {
    pub recipient_stream_nft_ata: AccountsStorage,

    pub rent: AccountsStorage,

    pub campaign_ata: AccountsStorage,

    pub campaign: AccountsStorage,

    pub stream_data: AccountsStorage,

    pub deposited_token_program: AccountsStorage,

    pub nft_collection_metadata: AccountsStorage,

    pub stream_recipient: AccountsStorage,

    pub recipient_ata: AccountsStorage,

    pub signer: AccountsStorage,

    pub creator: AccountsStorage,

    pub treasury: AccountsStorage,

    pub associated_token_program: AccountsStorage,

    pub stream_nft_metadata: AccountsStorage,

    pub airdrop_token_mint: AccountsStorage,

    pub stream_nft_master_edition: AccountsStorage,

    pub sender: AccountsStorage,

    pub nft_collection_mint: AccountsStorage,

    pub withdrawal_recipient: AccountsStorage,

    pub fee_recipient: AccountsStorage,

    pub airdrop_token_program: AccountsStorage,

    pub clawback_recipient: AccountsStorage,

    pub deposited_token_mint: AccountsStorage,

    pub claim_receipt: AccountsStorage,

    pub withdrawal_recipient_ata: AccountsStorage,

    pub system_program: AccountsStorage,

    pub initializer: AccountsStorage,

    pub fee_collector: AccountsStorage,

    pub sender_ata: AccountsStorage,

    pub stream_nft_mint: AccountsStorage,

    pub nft_token_program: AccountsStorage,

    pub recipient: AccountsStorage,

    pub nft_collection_data: AccountsStorage,

    pub nft_collection_ata: AccountsStorage,

    pub claimer: AccountsStorage,

    pub campaign_creator: AccountsStorage,

    pub chainlink_program: AccountsStorage,

    pub creator_ata: AccountsStorage,

    pub nft_collection_master_edition: AccountsStorage,

    pub clawback_recipient_ata: AccountsStorage,

    pub deposit_token_mint: AccountsStorage,

    pub deposit_token_program: AccountsStorage,

    pub token_metadata_program: AccountsStorage,

    pub chainlink_sol_usd_feed: AccountsStorage,

    pub stream_data_ata: AccountsStorage,
}
