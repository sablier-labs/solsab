use anchor_lang::{prelude::*, solana_program::sysvar::clock::Clock};

/// Returns the current time in seconds.
pub fn get_current_time() -> Result<u64> {
    Ok(Clock::get()?.unix_timestamp as u64) // The Unix timestamp is assumed to always be positive.
}
