use crate::time::get_current_time;
use anchor_lang::{prelude::*, solana_program::rent::Rent};
use chainlink_solana as chainlink;

const LAMPORTS_PER_SOL: u64 = 1e9 as u64; // 1 billion lamports in 1 SOL

/// Converts the fee amount from USD to lamports.
/// The price is considered to be 0 if:
/// 1. The USD fee is 0.
/// 2. The oracle price is ≤ 0.
/// 3. The oracle's update timestamp is in the future.
/// 4. The oracle price hasn't been updated in the last 24 hours.
pub fn convert_usd_fee_to_lamports<'info>(
    fee_usd: u64,
    chainlink_program: AccountInfo<'info>,
    chainlink_sol_usd_feed: AccountInfo<'info>,
) -> u64 {
    // If the USD fee is 0, skip the calculations.
    if fee_usd == 0 {
        return 0;
    }

    // Interactions: query the oracle price and the time at which it was updated.
    let round = match chainlink::latest_round_data(chainlink_program.clone(), chainlink_sol_usd_feed.clone()) {
        Ok(round) => round,
        Err(_) => return 0, // If the oracle call fails, skip fee charging.
    };

    let price = if round.answer > 0 {
        round.answer as u64
    } else {
        // If the price is not greater than 0, skip the calculations.
        return 0;
    };

    // Downcasting is safe as long as the date is before 7 February 2106 at 06:28:16 UTC.
    let current_timestamp: u32 = get_current_time().unwrap() as u32;

    // Due to reorgs and latency issues, the oracle can have a timestamp that is in the future. In
    // this case, we ignore the price and skip fee charging.
    if current_timestamp < round.timestamp {
        return 0;
    }

    // If the oracle hasn't been updated in the last 24 hours, we ignore the price and skip fee charging. This is a
    // safety check to avoid using outdated prices.
    const SECONDS_IN_24_HOURS: u32 = 86400;
    if current_timestamp - round.timestamp > SECONDS_IN_24_HOURS {
        return 0;
    }

    // Interactions: query the oracle decimals.
    let oracle_decimals = match chainlink::decimals(chainlink_program.clone(), chainlink_sol_usd_feed.clone()) {
        Ok(decimals) => decimals,
        Err(_) => return 0, // If the oracle call fails, skip fee charging.
    };

    let fee_in_lamports: u64 = match oracle_decimals {
        8 => {
            // If the oracle decimals are 8, calculate the fee.
            fee_usd * LAMPORTS_PER_SOL / price
        }
        decimals => {
            // Otherwise, adjust the calculation to account for the oracle decimals. `u128` is used to prevent overflow.
            ((fee_usd as u128) * 10_u128.pow(1 + decimals as u32) / (price as u128)) as u64
        }
    };

    fee_in_lamports
}

/// Helper function to calculate the amount collectable from an account. It takes an extra-safe approach by adding a
/// buffer to the rent exemption, ensuring that the account balance does not fall below the rent-exempt minimum (which
/// would, otherwise, make the program unusable).
pub fn safe_collectable_amount(account: &AccountInfo) -> Result<u64> {
    // Retrieve the current balance of the account.
    let current_balance = account.lamports();

    // Determine the size of the account's data.
    let data_len = account.data_len();

    // Retrieve the rent sysvar.
    let rent = Rent::get()?;

    // Calculate the minimum balance needed for rent exemption.
    let rent_exempt_minimum = rent.minimum_balance(data_len);

    let buffer = 1_000_000; // 0.001 SOL
    let safe_minimum = rent_exempt_minimum.checked_add(buffer).unwrap();

    // Return the collectable amount
    Ok(current_balance.saturating_sub(safe_minimum))
}
