use crate::types::{StreamData, StreamModel};
use trident_fuzz::fuzzing::*;

/// Checks if an account exists by verifying it has lamports.
pub fn account_exists(trident: &mut Trident, pubkey: &Pubkey) -> bool {
    let account = trident.get_account(pubkey);
    account.lamports() > 0
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

/// Get the owner of an MPL Core asset.
/// BaseAssetV1 layout: [1 byte Key discriminator][32 bytes owner]...
pub fn get_mpl_core_asset_owner(trident: &mut Trident, asset_pubkey: &Pubkey) -> Pubkey {
    let account = trident.get_account(asset_pubkey);
    let data = account.data();
    assert!(data.len() >= 33, "MPL Core asset account data too short");
    Pubkey::new_from_array(data[1..33].try_into().unwrap())
}

/// Get StreamData account from the trident client state.
pub fn get_stream_data(trident: &mut Trident, stream_data_pubkey: &Pubkey) -> StreamData {
    trident
        .get_account_with_type::<StreamData>(stream_data_pubkey, 8)
        .expect("Failed to deserialize stream_data account")
}

/// Extracts linear timestamps and unlock amounts from a StreamData's model.
/// Returns (start, cliff, end, start_unlock, cliff_unlock).
/// Panics if the model is not Linear.
pub fn get_linear_params(stream_data: &StreamData) -> (u64, u64, u64, u64, u64) {
    match &stream_data.model {
        StreamModel::Linear {
            timestamps,
            unlock_amounts,
        } => (timestamps.start, timestamps.cliff, timestamps.end, unlock_amounts.start, unlock_amounts.cliff),
        _ => panic!("Expected Linear stream model"),
    }
}
