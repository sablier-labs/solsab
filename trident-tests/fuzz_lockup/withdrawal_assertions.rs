use trident_fuzz::fuzzing::*;

use crate::{helpers::*, types::StreamData};

pub fn assert_withdrawal(
    client: &mut impl FuzzClient,
    stream_data: &StreamData,
    stream_data_ata: &TridentAccount,
    withdrawal_recipient_ata: &TridentAccount,
    expected_withdrawn_amount: u64,
    expected_total_withdrawn_amount: u64,
) {
    // Assert that the stream data has been updated correctly
    assert_eq!(
        stream_data.amounts.withdrawn, expected_total_withdrawn_amount,
        "Stream withdrawn amount should match the expected withdrawn amount",
    );

    // Assert the token balance changes
    assert_token_balance_changes_post_withdraw(
        client,
        stream_data_ata,
        withdrawal_recipient_ata,
        expected_withdrawn_amount,
    );
}

/// Assert token balances after a withdrawal
fn assert_token_balance_changes_post_withdraw(
    client: &mut impl FuzzClient,
    stream_data_ata: &TridentAccount,
    withdrawal_recipient_ata: &TridentAccount,
    expected_withdrawn_amount: u64,
) {
    // Get snapshot data from the accounts
    let stream_data_ata_snapshot_before = stream_data_ata.get_snapshot_before().data();
    let withdrawal_recipient_ata_snapshot_before = withdrawal_recipient_ata.get_snapshot_before().data();

    // Check that the stream data ATA balance has decreased by the withdrawn amount
    let stream_data_ata_balance_after = get_spl_ata_balance_via_client(client, &stream_data_ata.pubkey());
    let expected_stream_data_balance =
        get_spl_ata_balance_from_data(stream_data_ata_snapshot_before) - expected_withdrawn_amount;
    assert_eq!(
        stream_data_ata_balance_after, expected_stream_data_balance,
        "Stream data ATA balance should have decreased by the withdrawn amount"
    );

    // Check that the withdrawal recipient's token balance has increased by the withdrawn amount
    let withdrawal_recipient_ata_balance_after =
        get_spl_ata_balance_via_client(client, &withdrawal_recipient_ata.pubkey());
    let expected_withdrawal_recipient_ata_balance =
        get_spl_ata_balance_from_data(withdrawal_recipient_ata_snapshot_before) + expected_withdrawn_amount;
    assert_eq!(
        withdrawal_recipient_ata_balance_after, expected_withdrawal_recipient_ata_balance,
        "Withdrawal recipient ATA balance should have increased by the withdrawn amount"
    );
}
