use crate::utils::constants::LAMPORTS_PER_SOL;
use anchor_lang::prelude::*;
use chainlink_solana as chainlink;

// TODO: export this into a crate that'd be imported by both the lockup and merkle_instant programs.
/// Converts the fee amount from USD to lamports.
/// The price is considered to be 0 if:
/// 1. The USD fee is 0.
/// 2. The oracle price is ≤ 0.
/// 3. The oracle's update timestamp is in the future.
/// 4. The oracle price hasn't been updated in the last 24 hours.
pub fn convert_usd_to_fee_in_lamports<'info>(
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

    // If the price is not greater than 0, skip the calculations.
    if round.answer <= 0 {
        return 0;
    }

    let current_timestamp: u32 = Clock::get().unwrap().unix_timestamp as u32;

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

    let price = round.answer as u64;

    let fee_in_lamports: u64 = match oracle_decimals {
        8 => {
            // If the oracle decimals are 8, calculate the fee.
            fee_usd * LAMPORTS_PER_SOL / price
        }
        decimals => {
            // Otherwise, adjust the calculation to account for the oracle decimals.
            fee_usd * 10_u64.pow(1 + decimals as u32) / price
        }
    };

    fee_in_lamports
}
