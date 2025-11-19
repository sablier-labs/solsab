use solana_sdk::clock::Clock;
use trident_fuzz::fuzzing::*;

/// Get the current time in seconds from Trident
pub fn get_current_time_from_trident(trident: &mut Trident) -> u64 {
    get_current_time_from_client(trident.get_client())
}

/// Get the current time in seconds from FuzzClient
pub fn get_current_time_from_client(client: &mut impl FuzzClient) -> u64 {
    client.get_sysvar::<Clock>().unix_timestamp as u64
}
