use crate::{fuzz_accounts::AccountAddresses, helpers::*, types::StreamData};
use trident_fuzz::fuzzing::*;

/// Checks if an account exists by verifying it has lamports and data.
pub fn account_exists(trident: &mut Trident, pubkey: &Pubkey) -> bool {
    let account = trident.get_account(pubkey);
    account.lamports() > 0 && !account.data().is_empty()
}

/// Creates a new user and funds it with the default lamports balance.
pub fn create_user(trident: &mut Trident) -> Pubkey {
    let keypair = Keypair::new();
    let pubkey = keypair.pubkey();
    trident.airdrop(&pubkey, DEFAULT_LAMPORTS_BALANCE);
    pubkey
}

/// Creates default users (creator, recipient, sender, signer) and stores them in fuzz_accounts.
pub fn create_users(trident: &mut Trident, fuzz_accounts: &mut AccountAddresses) {
    let creator = create_user(trident);
    fuzz_accounts.creator.insert_with_address(creator);

    let recipient = create_user(trident);
    fuzz_accounts.recipient.insert_with_address(recipient);

    let sender = create_user(trident);
    fuzz_accounts.sender.insert_with_address(sender);

    let signer = create_user(trident);
    fuzz_accounts.signer.insert_with_address(signer);
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

/// Parses u64 return data from transaction logs.
/// Looks for "Program return: <program_id> <base64_data>" and decodes the base64 data.
/// Note: logs() returns debug-formatted Vec<String>, so we search for the pattern in the raw string.
pub fn parse_return_data_from_logs(logs: &str) -> Option<u64> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    // Find "Program return:" and extract the base64 data after the program ID
    // Format in logs: "Program return: <program_id> <base64_data>"
    if let Some(start) = logs.find("Program return:") {
        let after_prefix = &logs[start + "Program return:".len()..];
        // Split by whitespace and get: program_id, base64_data
        let parts: Vec<&str> = after_prefix.split_whitespace().take(2).collect();
        if parts.len() >= 2 {
            // Remove any trailing quotes or punctuation from base64 data
            let base64_data = parts[1].trim_end_matches(['"', ',', ']']);
            if let Ok(bytes) = STANDARD.decode(base64_data) {
                if bytes.len() >= 8 {
                    return Some(u64::from_le_bytes(bytes[..8].try_into().unwrap()));
                }
            }
        }
    }
    None
}
