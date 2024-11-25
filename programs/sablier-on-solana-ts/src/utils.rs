use anchor_lang::solana_program::sysvar::{clock::Clock, Sysvar};

use crate::Stream;

pub fn get_streamed_amount(stream: &Stream) -> u64 {
    let current_time = Clock::get().unwrap().unix_timestamp;

    if stream.cliff_time > current_time || stream.start_time > current_time {
        return 0; // No assets have been streamed yet
    }

    if stream.end_time < current_time {
        return stream.amounts.deposited; // All assets have been streamed
    }

    // Calculate the streamed amount
    let elapsed_time = current_time - stream.start_time;
    let total_duration = stream.end_time - stream.start_time;
    (stream.amounts.deposited as u128 * elapsed_time as u128 / total_duration as u128) as u64
}

pub fn get_withdrawable_amount(stream: &Stream) -> u64 {
    get_streamed_amount(stream) - stream.amounts.withdrawn
}
