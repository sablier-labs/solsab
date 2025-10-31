use trident_fuzz::fuzzing::*;

use crate::{helpers::*, types::StreamData};

/// Comprehensive invariant system for stream transactions
/// This module provides a centralized way to validate stream invariants
/// across all transaction types, avoiding code duplication while ensuring
/// comprehensive coverage of protocol-level constraints.

/// Validate universal invariants using snapshot data (for use in transaction_invariant_check)
pub fn check_universal_invariants(stream_data: &TridentAccount, stream_data_ata: &TridentAccount, current_time: u64) {
    // Deserialize stream data from snapshots
    let stream_data_after = StreamData::try_from_slice(&stream_data.get_snapshot_after().data()[8..])
        .expect("Failed to deserialize StreamData");

    assert!(stream_data_after.amounts.deposited > 0, "Deposited amount must be greater than 0");

    assert!(
        stream_data_after.timestamps.end > stream_data_after.timestamps.start,
        "End time must be greater than start time"
    );

    assert!(stream_data_after.timestamps.start > 0, "Start time must not be 0");

    if stream_data_after.timestamps.cliff > 0 {
        assert!(
            stream_data_after.timestamps.cliff > stream_data_after.timestamps.start,
            "Cliff time must be greater than start time"
        );
    }

    assert!(
        stream_data_after.timestamps.end > stream_data_after.timestamps.cliff,
        "End time must be greater than cliff time"
    );

    // Get the stream data ATA balance after the tx
    let stream_data_ata_balance_after = get_spl_ata_balance_from_data(stream_data_ata.get_snapshot_after().data());

    // Calculate the expected stream data ATA balance after the tx
    let expected_balance_after = stream_data_after
        .amounts
        .deposited
        .saturating_sub(stream_data_after.amounts.refunded)
        .saturating_sub(stream_data_after.amounts.withdrawn);

    assert_eq!(
        stream_data_ata_balance_after, expected_balance_after,
        "Stream data ATA balance must equal deposited - refunded - withdrawn"
    );

    assert!(
        stream_data_after.amounts.deposited >= stream_data_after.amounts.withdrawn,
        "Deposited amount must be >= withdrawn amount"
    );

    assert!(
        stream_data_after.amounts.deposited >= stream_data_after.amounts.refunded,
        "Deposited amount must be >= refunded amount"
    );

    assert!(!(stream_data_after.was_canceled && stream_data_after.is_cancelable), "was_canceled == is_cancelable");

    // If the stream is pending, perform additional assertions
    if current_time < stream_data_after.timestamps.start {
        check_pending_stream(&stream_data_after, current_time);
    }

    // If the stream is canceled, perform additional assertions
    if stream_data_after.was_canceled {
        check_canceled_stream(&stream_data_after, current_time);
    }

    // If the stream is depleted, perform additional assertions
    if is_stream_depleted(&stream_data_after.amounts) {
        check_depleted_stream(&stream_data_after, current_time);
    }
}

fn check_canceled_stream(stream_data: &StreamData, current_time: u64) {
    assert!(!stream_data.is_cancelable, "A canceled stream should not be cancelable",);
    assert!(stream_data.amounts.refunded > 0, "The refunded amount of a canceled stream must be greater than 0");

    // Assert that the refundable amount is 0
    let refundable_amount = get_refundable_amount(
        &stream_data.timestamps,
        &stream_data.amounts,
        stream_data.is_cancelable,
        stream_data.is_depleted,
        stream_data.was_canceled,
        current_time,
    );
    assert_eq!(refundable_amount, 0, "The refundable amount of a canceled stream must be 0");
}

/// Validate create-specific invariants for stream creation transactions
pub fn check_create_invariants(creator_ata: &TridentAccount, stream_data_ata: &TridentAccount) {
    let creator_ata_balance_before = get_spl_ata_balance_from_data(creator_ata.get_snapshot_before().data());

    let creator_ata_balance_after = get_spl_ata_balance_from_data(creator_ata.get_snapshot_after().data());
    let stream_data_ata_balance_after = get_spl_ata_balance_from_data(stream_data_ata.get_snapshot_after().data());

    assert_eq!(
        creator_ata_balance_before,
        creator_ata_balance_after + stream_data_ata_balance_after,
        "Token balance invariant violated"
    );
}

fn check_depleted_stream(stream_data: &StreamData, current_time: u64) {
    assert!(!stream_data.is_cancelable, "Stream should not be cancelable after a full withdrawal",);
    assert!(stream_data.is_depleted, "Stream should be depleted after a full withdrawal",);

    // Assert that the refunded amount is 0
    assert_eq!(stream_data.amounts.refunded, 0, "The refunded amount of a depleted stream must be 0");

    // Assert that the withdrawable amount is 0
    let withdrawable_amount = get_withdrawable_amount(
        &stream_data.timestamps,
        &stream_data.amounts,
        stream_data.is_depleted,
        stream_data.was_canceled,
        current_time,
    );
    assert_eq!(withdrawable_amount, 0, "The withdrawable amount of a depleted stream must be 0");

    // Assert that the refundable amount is 0
    let refundable_amount = get_refundable_amount(
        &stream_data.timestamps,
        &stream_data.amounts,
        stream_data.is_cancelable,
        stream_data.is_depleted,
        stream_data.was_canceled,
        current_time,
    );
    assert_eq!(refundable_amount, 0, "The refundable amount of a depleted stream must be 0");
}

fn check_pending_stream(stream_data: &StreamData, current_time: u64) {
    // Get the refundable amount
    let refundable_amount = get_refundable_amount(
        &stream_data.timestamps,
        &stream_data.amounts,
        stream_data.is_cancelable,
        stream_data.is_depleted,
        stream_data.was_canceled,
        current_time,
    );

    if !stream_data.is_cancelable {
        if !stream_data.was_canceled {
            assert_eq!(stream_data.amounts.refunded, 0, "The refunded amount of a pending stream must be 0");
            assert_eq!(refundable_amount, 0, "The refundable amount of a non-cancelable stream must be 0");
            assert!(!stream_data.is_depleted, "A pending non-cancelable stream should not be depleted");
        }
    } else if stream_data.was_canceled {
        assert_eq!(refundable_amount, 0, "The refundable amount of a canceled pending stream must be 0");
        assert_eq!(
            stream_data.amounts.refunded, stream_data.amounts.deposited,
            "The refunded amount of a canceled pending stream must be the deposited amount"
        );
        assert!(stream_data.is_depleted, "A canceled pending stream should be depleted");
    } else {
        assert_eq!(
            refundable_amount, stream_data.amounts.deposited,
            "The refundable amount of a pending stream must be the deposited amount"
        );
        assert_eq!(stream_data.amounts.refunded, 0, "The refunded amount of a pending cancelable stream must be 0");
        assert!(!stream_data.is_depleted, "A pending cancelable stream should not be depleted");
    }
}

// TODO: implement the below functions (and update the ones above) when Trident supports accessing the result of the ix
// execution (i.e. the statusOf the stream) fn check_streaming_stream(stream_data: &StreamData, current_time: u64) {}
// fn check_settled_stream(stream_data: &StreamData, current_time: u64) {}
