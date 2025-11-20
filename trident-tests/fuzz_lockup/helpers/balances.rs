use solana_sdk::pubkey::Pubkey;
use trident_fuzz::fuzzing::*;

/// Get SPL ATA balance via FuzzClient by Pubkey
pub fn get_spl_ata_balance_via_client(client: &mut impl FuzzClient, pubkey: &Pubkey) -> u64 {
    let account = client.get_account(pubkey);
    get_spl_ata_balance_from_data(account.data())
}

/// Get SPL Token balance of the ATA from the client state.
/// Layout (prefix):
/// - 32 bytes: mint
/// - 32 bytes: owner
/// - 8  bytes: amount (u64, LE)
pub fn get_spl_ata_balance_from_data(data: &[u8]) -> u64 {
    if data.len() < 72 {
        return 0;
    }
    // The amount is at offset 64 (32 bytes mint + 32 bytes owner)
    let amount_bytes = &data[64..72];
    u64::from_le_bytes(amount_bytes.try_into().unwrap())
}

/// Get mint total supply by pubkey
pub fn get_mint_total_supply_by_pubkey(client: &mut impl FuzzClient, pubkey: &Pubkey) -> u64 {
    let account = client.get_account(pubkey);
    get_mint_total_supply_from_data(account.data())
}

/// Get mint total supply from SPL token mint account data
/// SPL Token mint layout (82 bytes):
/// - 36 bytes: mint_authority (COption<Pubkey>)
/// - 8 bytes: supply (u64)
/// - 1 byte: decimals (u8)
/// - 1 byte: is_initialized (bool)
/// - 36 bytes: freeze_authority (COption<Pubkey>)
pub fn get_mint_total_supply_from_data(data: &[u8]) -> u64 {
    if data.len() < 82 {
        return 0;
    }
    // The supply is at offset 36 (mint_authority: 36 bytes)
    let supply_bytes = &data[36..44];
    u64::from_le_bytes(supply_bytes.try_into().unwrap())
}

/// Check if an account exists
pub fn account_exists(client: &mut impl FuzzClient, pubkey: &Pubkey) -> bool {
    let account = client.get_account(pubkey);
    account.lamports() > 0 && !account.data().is_empty()
}
