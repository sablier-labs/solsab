use crate::helpers::*;
use trident_fuzz::fuzzing::*;

/// Creates a new user and funds it with the default lamports balance.
pub fn create_user(trident: &mut Trident) -> Pubkey {
    let keypair = Keypair::new();
    let pubkey = keypair.pubkey();
    trident.airdrop(&pubkey, DEFAULT_LAMPORTS_BALANCE);
    pubkey
}
