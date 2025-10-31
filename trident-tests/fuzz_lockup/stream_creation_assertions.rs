use crate::{
    helpers::*,
    instructions::{
        CreateWithDurationsLlInstructionAccounts, CreateWithDurationsLlInstructionData,
        CreateWithTimestampsLlInstructionAccounts, CreateWithTimestampsLlInstructionData,
    },
};
use trident_fuzz::fuzzing::*;

// Type aliases for cleaner function signatures
type CWDIxAccounts = CreateWithDurationsLlInstructionAccounts;
type CWDIxData = CreateWithDurationsLlInstructionData;
type CWTIxAccounts = CreateWithTimestampsLlInstructionAccounts;
type CWTIxData = CreateWithTimestampsLlInstructionData;

/// Common assertions for stream creation transactions
pub struct StreamCreationAssertions;

impl StreamCreationAssertions {
    /// Assert all stream creation properties for duration-based streams
    pub fn assert_create_with_durations(client: &mut impl FuzzClient, accounts: &CWDIxAccounts, data: &CWDIxData) {
        // Assert common stream properties
        Self::assert_common_stream_properties(
            client,
            &accounts.stream_data.pubkey(),
            &accounts.sender.pubkey(),
            &accounts.deposit_token_mint.pubkey(),
            data.deposit_amount,
            data.is_cancelable,
            data.start_unlock_amount,
            data.cliff_unlock_amount,
        );

        // Assert duration-specific properties
        Self::assert_duration_stream_properties(
            client,
            &accounts.stream_data.pubkey(),
            data.cliff_duration,
            data.total_duration,
        );

        // Assert NFT properties
        Self::assert_nft_properties(
            client,
            &accounts.stream_nft_mint.pubkey(),
            &accounts.stream_nft_metadata.pubkey(),
            &accounts.stream_nft_master_edition.pubkey(),
            &accounts.recipient_stream_nft_ata.pubkey(),
        );

        // Assert token balance changes
        Self::assert_token_balance_changes(
            client,
            &accounts.creator_ata,
            &accounts.stream_data_ata,
            data.deposit_amount,
        );
    }

    /// Assert all stream creation properties for timestamp-based streams
    pub fn assert_create_with_timestamps(client: &mut impl FuzzClient, accounts: &CWTIxAccounts, data: &CWTIxData) {
        // Assert common stream properties
        Self::assert_common_stream_properties(
            client,
            &accounts.stream_data.pubkey(),
            &accounts.sender.pubkey(),
            &accounts.deposit_token_mint.pubkey(),
            data.deposit_amount,
            data.is_cancelable,
            data.start_unlock_amount,
            data.cliff_unlock_amount,
        );

        // Assert timestamp-specific properties
        Self::assert_timestamp_stream_properties(
            client,
            &accounts.stream_data.pubkey(),
            data.start_time,
            data.cliff_time,
            data.end_time,
        );

        // Assert NFT properties
        Self::assert_nft_properties(
            client,
            &accounts.stream_nft_mint.pubkey(),
            &accounts.stream_nft_metadata.pubkey(),
            &accounts.stream_nft_master_edition.pubkey(),
            &accounts.recipient_stream_nft_ata.pubkey(),
        );

        // Assert token balance changes
        Self::assert_token_balance_changes(
            client,
            &accounts.creator_ata,
            &accounts.stream_data_ata,
            data.deposit_amount,
        );
    }

    /// Common asserts for duration and timestamp-based stream creations
    #[allow(clippy::too_many_arguments)]
    fn assert_common_stream_properties(
        client: &mut impl FuzzClient,
        stream_data_pubkey: &Pubkey,
        sender_pubkey: &Pubkey,
        deposit_token_mint_pubkey: &Pubkey,
        deposit_amount: u64,
        is_cancelable: bool,
        start_unlock_amount: u64,
        cliff_unlock_amount: u64,
    ) {
        let stream_data = get_stream_data_from_client(client, stream_data_pubkey);

        // Basic stream properties
        assert_eq!(stream_data.amounts.deposited, deposit_amount, "deposited_amount");
        assert_eq!(stream_data.is_cancelable, is_cancelable, "is_cancelable");
        assert!(!stream_data.was_canceled, "was_canceled");
        assert!(!stream_data.is_depleted, "is_depleted");

        // Account references
        assert_eq!(stream_data.sender.get_pubkey(), *sender_pubkey, "sender");
        assert_eq!(stream_data.deposited_token_mint.get_pubkey(), *deposit_token_mint_pubkey, "deposit_token_mint");

        // Unlock amounts
        let expected_unlock_amounts = (start_unlock_amount, cliff_unlock_amount);
        let actual_unlock_amounts = (stream_data.amounts.start_unlock, stream_data.amounts.cliff_unlock);
        assert_eq!(actual_unlock_amounts, expected_unlock_amounts, "unlock amounts");
    }

    /// Assert NFT-related properties for stream creation
    fn assert_nft_properties(
        client: &mut impl FuzzClient,
        stream_nft_mint_pubkey: &Pubkey,
        stream_nft_metadata_pubkey: &Pubkey,
        stream_nft_master_edition_pubkey: &Pubkey,
        recipient_stream_nft_ata_pubkey: &Pubkey,
    ) {
        // Check that all required NFT accounts exist
        assert!(account_exists(client, stream_nft_mint_pubkey), "Stream NFT Mint account should exist");
        assert!(account_exists(client, stream_nft_metadata_pubkey), "Stream NFT Metadata account should exist");
        assert!(
            account_exists(client, stream_nft_master_edition_pubkey),
            "Stream NFT Master Edition account should exist"
        );
        assert!(
            account_exists(client, recipient_stream_nft_ata_pubkey),
            "Recipient Stream NFT ATA account should exist"
        );

        // Check that the Stream NFT Mint has the correct total supply (should be 1)
        let stream_nft_mint_supply = get_mint_total_supply_by_pubkey(client, stream_nft_mint_pubkey);
        assert_eq!(stream_nft_mint_supply, 1, "Stream NFT Mint total supply should be 1");

        // Check that the stream NFT was minted to the correct recipient
        let recipient_nft_balance = get_spl_ata_balance_via_client(client, recipient_stream_nft_ata_pubkey);
        assert_eq!(recipient_nft_balance, 1, "recipient should have 1 stream NFT");
    }

    /// Assert token balance changes for stream creation
    fn assert_token_balance_changes(
        client: &mut impl FuzzClient,
        creator_ata: &TridentAccount,
        stream_data_ata: &TridentAccount,
        deposit_amount: u64,
    ) {
        // Get snapshot data from the accounts
        let creator_ata_snapshot_before = creator_ata.get_snapshot_before().data();
        let stream_data_ata_snapshot_before = stream_data_ata.get_snapshot_before().data();

        // Check that the sender's token balance decreased by the deposit amount
        let sender_ata_balance_after = get_spl_ata_balance_via_client(client, &creator_ata.pubkey());
        let expected_sender_balance = get_spl_ata_balance_from_data(creator_ata_snapshot_before) - deposit_amount;
        assert_eq!(
            sender_ata_balance_after, expected_sender_balance,
            "sender balance should have decreased by deposit amount"
        );

        // Check that the Stream Data ATA balance has increased by the deposit amount
        let stream_data_ata_balance_after = get_spl_ata_balance_via_client(client, &stream_data_ata.pubkey());
        let expected_stream_data_balance =
            get_spl_ata_balance_from_data(stream_data_ata_snapshot_before) + deposit_amount;
        assert_eq!(
            stream_data_ata_balance_after, expected_stream_data_balance,
            "stream data balance should have increased by deposit amount"
        );
    }

    /// Assert timestamp-based stream properties
    fn assert_timestamp_stream_properties(
        client: &mut impl FuzzClient,
        stream_data_pubkey: &Pubkey,
        start_time: u64,
        cliff_time: u64,
        end_time: u64,
    ) {
        let stream_data = get_stream_data_from_client(client, stream_data_pubkey);

        // For timestamp-based streams, the start time should match the instruction data
        assert_eq!(stream_data.timestamps.start, start_time, "start_time");

        // Cliff and end times should match the instruction data
        assert_eq!(stream_data.timestamps.cliff, cliff_time, "cliff_time");
        assert_eq!(stream_data.timestamps.end, end_time, "end_time");
    }

    /// Assert duration-based stream properties
    fn assert_duration_stream_properties(
        client: &mut impl FuzzClient,
        stream_data_pubkey: &Pubkey,
        cliff_duration: u64,
        total_duration: u64,
    ) {
        let stream_data = get_stream_data_from_client(client, stream_data_pubkey);

        // Start time should be either equal to or 1 second before the current time
        let current_time = get_current_time_from_client(client);
        assert!(
            stream_data.timestamps.start == current_time || stream_data.timestamps.start == current_time - 1,
            "start_time: got {}, expected {} or {}",
            stream_data.timestamps.start,
            current_time,
            current_time - 1
        );

        // Define the expected start time as the actual start time
        let expected_start_time = stream_data.timestamps.start;

        // Calculate expected cliff and end times
        let expected_cliff_time = if cliff_duration > 0 {
            expected_start_time.checked_add(cliff_duration).unwrap()
        } else {
            0
        };
        let expected_end_time = expected_start_time.checked_add(total_duration).unwrap();

        assert_eq!(stream_data.timestamps.cliff, expected_cliff_time, "cliff_time");
        assert_eq!(stream_data.timestamps.end, expected_end_time, "end_time");
    }
}
