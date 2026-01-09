use crate::types::StreamData;
use trident_fuzz::fuzzing::*;

/// Checks if an account exists by verifying it has lamports and data.
pub fn account_exists(trident: &mut Trident, pubkey: &Pubkey) -> bool {
    let account = trident.get_account(pubkey);
    account.lamports() > 0 && !account.data().is_empty()
}

/// Get SPL Token balance of the ATA from the client state.
/// Layout (prefix):
/// - 32 bytes: mint
/// - 32 bytes: owner
/// - 8  bytes: amount (u64, LE)
pub fn get_ata_token_balance(trident: &mut Trident, ata_pubkey: &Pubkey) -> u64 {
    let account = trident.get_account(ata_pubkey);
    let data = account.data();
    if data.len() < 72 {
        return 0;
    }
    // The amount is at offset 64 (32 bytes mint + 32 bytes owner)
    let amount_bytes = &data[64..72];
    u64::from_le_bytes(amount_bytes.try_into().unwrap())
}

/// Get mint total supply from SPL token mint account data
/// SPL Token mint layout (82 bytes):
/// - 36 bytes: mint_authority (COption<Pubkey>)
/// - 8 bytes: supply (u64)
/// - 1 byte: decimals (u8)
/// - 1 byte: is_initialized (bool)
/// - 36 bytes: freeze_authority (COption<Pubkey>)
pub fn get_mint_total_supply(trident: &mut Trident, pubkey: &Pubkey) -> u64 {
    let account = trident.get_account(pubkey);
    let data = account.data();
    if data.len() < 82 {
        return 0;
    }
    // The supply is at offset 36 (mint_authority: 36 bytes)
    let supply_bytes = &data[36..44];
    u64::from_le_bytes(supply_bytes.try_into().unwrap())
}

/// Get StreamData account from the trident client state.
pub fn get_stream_data(trident: &mut Trident, stream_data_pubkey: &Pubkey) -> StreamData {
    trident
        .get_account_with_type::<StreamData>(stream_data_pubkey, 8)
        .expect("Failed to deserialize stream_data account")
}
