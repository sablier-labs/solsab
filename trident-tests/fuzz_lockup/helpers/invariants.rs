use super::{
    get_ata_token_balance, get_linear_params, get_refundable_amount, get_stream_data, get_streamed_amount,
    get_withdrawable_amount,
};
use trident_fuzz::fuzzing::{Pubkey, Trident};

/// Validates universal invariants that must hold after every transaction.
pub fn check_universal_invariants(trident: &mut Trident, stream_data_pubkey: &Pubkey, stream_data_ata_pubkey: &Pubkey) {
    let stream_data = get_stream_data(trident, stream_data_pubkey);
    let (start, cliff, end, _, _) = get_linear_params(&stream_data);

    // Amount invariants
    assert!(stream_data.amounts.deposited > 0, "Deposited amount must be greater than 0");
    assert!(
        stream_data.amounts.deposited >= stream_data.amounts.withdrawn,
        "Deposited amount must be >= withdrawn amount"
    );
    assert!(
        stream_data.amounts.deposited >= stream_data.amounts.refunded,
        "Deposited amount must be >= refunded amount"
    );

    // Timestamp invariants
    assert!(start > 0, "Start time must not be 0");
    assert!(end > start, "End time must be greater than start time");
    if cliff > 0 {
        assert!(cliff > start, "Cliff time must be greater than start time");
        assert!(end > cliff, "End time must be greater than cliff time");
    }

    // Cancelability invariants
    assert!(!(stream_data.was_canceled && stream_data.is_cancelable), "A canceled stream must not be cancelable");

    // Stream Data Token balance == deposited - refunded - withdrawn
    let stream_data_ata_balance = get_ata_token_balance(trident, stream_data_ata_pubkey);
    let expected_balance = stream_data
        .amounts
        .deposited
        .saturating_sub(stream_data.amounts.refunded)
        .saturating_sub(stream_data.amounts.withdrawn);
    assert_eq!(
        stream_data_ata_balance, expected_balance,
        "Stream data ATA balance must equal deposited - refunded - withdrawn"
    );

    // Status-specific invariants
    let now = trident.get_current_timestamp() as u64;

    if stream_data.is_depleted {
        check_depleted_stream(trident, stream_data_pubkey);
    } else if stream_data.was_canceled {
        check_canceled_stream(trident, stream_data_pubkey);
    } else if now < start {
        check_pending_stream(trident, stream_data_pubkey);
    } else if now >= end {
        check_settled_stream(trident, stream_data_pubkey);
    } else {
        check_streaming_stream(trident, stream_data_pubkey);
    }
}

fn check_depleted_stream(trident: &mut Trident, stream_data_pubkey: &Pubkey) {
    let stream_data = get_stream_data(trident, stream_data_pubkey);

    assert!(!stream_data.is_cancelable, "A depleted stream must not be cancelable");

    let withdrawable = get_withdrawable_amount(trident, stream_data_pubkey);
    assert_eq!(withdrawable, 0, "Withdrawable amount of a depleted stream must be 0");

    let refundable = get_refundable_amount(trident, stream_data_pubkey);
    assert_eq!(refundable, 0, "Refundable amount of a depleted stream must be 0");
}

fn check_canceled_stream(trident: &mut Trident, stream_data_pubkey: &Pubkey) {
    let stream_data = get_stream_data(trident, stream_data_pubkey);

    assert!(!stream_data.is_cancelable, "A canceled stream must not be cancelable");
    assert!(stream_data.amounts.refunded > 0, "Refunded amount of a canceled stream must be greater than 0");

    let refundable = get_refundable_amount(trident, stream_data_pubkey);
    assert_eq!(refundable, 0, "Refundable amount of a canceled stream must be 0");
}

fn check_settled_stream(trident: &mut Trident, stream_data_pubkey: &Pubkey) {
    let stream_data = get_stream_data(trident, stream_data_pubkey);

    let refundable = get_refundable_amount(trident, stream_data_pubkey);
    assert_eq!(refundable, 0, "Refundable amount of a settled stream must be 0");

    let withdrawable = get_withdrawable_amount(trident, stream_data_pubkey);
    assert_eq!(
        withdrawable,
        stream_data.amounts.deposited - stream_data.amounts.withdrawn,
        "Withdrawable amount of a settled stream must equal deposited - withdrawn"
    );
}

fn check_streaming_stream(trident: &mut Trident, stream_data_pubkey: &Pubkey) {
    let stream_data = get_stream_data(trident, stream_data_pubkey);

    let streamed = get_streamed_amount(trident, stream_data_pubkey);
    assert!(streamed > 0, "Streamed amount of a streaming stream must be greater than 0");
    assert!(
        streamed < stream_data.amounts.deposited,
        "Streamed amount of a streaming stream must be less than deposited"
    );

    let refundable = get_refundable_amount(trident, stream_data_pubkey);
    if stream_data.is_cancelable {
        assert!(refundable > 0, "Refundable amount of a cancelable streaming stream must be greater than 0");
    } else {
        assert_eq!(refundable, 0, "Refundable amount of a non-cancelable streaming stream must be 0");
    }
}

fn check_pending_stream(trident: &mut Trident, stream_data_pubkey: &Pubkey) {
    let stream_data = get_stream_data(trident, stream_data_pubkey);
    let refundable = get_refundable_amount(trident, stream_data_pubkey);

    if stream_data.is_cancelable {
        assert_eq!(
            refundable, stream_data.amounts.deposited,
            "Refundable amount of a pending cancelable stream must equal deposited"
        );
        assert_eq!(stream_data.amounts.refunded, 0, "Refunded amount of a pending cancelable stream must be 0");
    } else {
        assert_eq!(stream_data.amounts.refunded, 0, "Refunded amount of a pending stream must be 0");
        assert_eq!(refundable, 0, "Refundable amount of a non-cancelable stream must be 0");
    }
}
