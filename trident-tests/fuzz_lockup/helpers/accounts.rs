use crate::constants::{DEFAULT_LAMPORTS_BALANCE, SYSTEM_PROGRAM_ID};
use solana_sdk::pubkey::Pubkey;
use trident_fuzz::fuzzing::*;

/// Create a user account in the client
pub fn create_user_account_in_client(trident: &mut Trident) -> Pubkey {
    let pubkey = trident.gen_pubkey();
    trident.get_client().set_account_custom(
        &pubkey,
        &AccountSharedData::create(DEFAULT_LAMPORTS_BALANCE, Vec::new(), SYSTEM_PROGRAM_ID.parse().unwrap(), false, 0),
    );
    pubkey
}

/// Create a user account in the AccountsStorage
pub fn create_user_account_in_storage(storage: &mut AccountsStorage, account_id: u8, trident: &mut Trident) -> Pubkey {
    storage.get_or_create(
        account_id,
        trident,
        None,
        Some(AccountMetadata {
            lamports: DEFAULT_LAMPORTS_BALANCE,
            space: 0,
            owner: SYSTEM_PROGRAM_ID.parse().unwrap(),
        }),
    )
}
