use super::{get_linear_params, get_stream_data};
use trident_fuzz::fuzzing::{Pubkey, Trident};

/// This file matches the logic from programs/lockup/src/utils/lockup_math.rs with some edits.
pub fn get_streamed_amount(trident: &mut Trident, stream_data_pk: &Pubkey) -> u64 {
    let stream_data = get_stream_data(trident, stream_data_pk);
    let now = trident.get_current_timestamp() as u64;

    if stream_data.is_depleted {
        return stream_data.amounts.withdrawn;
    } else if stream_data.was_canceled {
        return stream_data.amounts.deposited - stream_data.amounts.refunded;
    }

    let (start, cliff, end, start_unlock, cliff_unlock) = get_linear_params(&stream_data);

    // If the start time is in the future, return zero.
    if start > now {
        return 0;
    }

    // If the cliff time is in the future, return the start unlock amount.
    if cliff > now {
        return start_unlock;
    }

    // If the end time is in the past, return the deposited amount.
    if now > end {
        return stream_data.amounts.deposited;
    }

    // Calculate the sum of the unlock amounts.
    let unlock_amounts_sum: u64 = start_unlock + cliff_unlock;

    // If the sum of the unlock amounts is greater than or equal to the deposited amount, return the deposited
    // amount. The ">=" operator is used as a safety measure in case of a bug, as the sum of the unlock amounts
    // should never exceed the deposited amount.
    if unlock_amounts_sum >= stream_data.amounts.deposited {
        return stream_data.amounts.deposited;
    }

    // Determine the streaming start time.
    let streaming_start_time = if cliff == 0 { start } else { cliff };

    const SCALING_FACTOR: u128 = 1e18 as u128;

    // Calculate time variables. Scale to 18 decimals for increased precision and cast to u128 to prevent overflow.
    let elapsed_time = (now - streaming_start_time) as u128 * SCALING_FACTOR;
    let streamable_range = (end - streaming_start_time) as u128;
    let elapsed_time_percentage = elapsed_time / streamable_range;

    // Calculate the streamable amount.
    let streamable_amount = (stream_data.amounts.deposited - unlock_amounts_sum) as u128;

    // Calculate the streamed amount. After dividing by the scaling factor, casting down to u64 is safe.
    let streamed_amount = unlock_amounts_sum + ((elapsed_time_percentage * streamable_amount) / SCALING_FACTOR) as u64;

    // Although the streamed amount should never exceed the deposited amount, this condition is checked
    // without asserting to avoid locking tokens in case of a bug. If this situation occurs, the withdrawn
    // amount is considered to be the streamed amount, and the stream is effectively frozen.
    if streamed_amount > stream_data.amounts.deposited {
        return stream_data.amounts.withdrawn;
    }

    streamed_amount
}

pub fn get_refundable_amount(trident: &mut Trident, stream_data_pk: &Pubkey) -> u64 {
    let stream_data = get_stream_data(trident, stream_data_pk);

    // Note that checking for `is_cancelable` also checks if the stream `was_canceled` thanks to the protocol
    // invariant that canceled streams are not cancelable anymore.
    if stream_data.is_cancelable && !stream_data.is_depleted {
        return stream_data.amounts.deposited.saturating_sub(get_streamed_amount(trident, stream_data_pk));
    }

    // Otherwise, return zero.
    0
}

pub fn get_withdrawable_amount(trident: &mut Trident, stream_data_pk: &Pubkey) -> u64 {
    let stream_data = get_stream_data(trident, stream_data_pk);
    get_streamed_amount(trident, stream_data_pk).saturating_sub(stream_data.amounts.withdrawn)
}
