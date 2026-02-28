use anchor_lang::prelude::*;

/// Helper function to calculate the collectable amount from an account. As a precaution, we add a buffer to the rent
/// exemption, ensuring that the account balance will not fall below the rent-exempt minimum. This could otherwise
/// make the program unusable.
pub fn safe_collectible_amount(account: &AccountInfo) -> Result<u64> {
    // Retrieve the current balance of the account.
    let current_balance = account.lamports();

    // Determine the size of the account's data.
    let data_len = account.data_len();

    // Retrieve the rent sysvar.
    let rent = Rent::get()?;

    // Calculate the minimum balance needed for rent exemption.
    let rent_exempt_minimum = rent.minimum_balance(data_len);

    const SAFE_RENT_BUFFER_LAMPORTS: u64 = 1_000_000; // 0.001 SOL
    let safe_minimum = rent_exempt_minimum.checked_add(SAFE_RENT_BUFFER_LAMPORTS).unwrap();

    // Return the collectable amount
    Ok(current_balance.saturating_sub(safe_minimum))
}
