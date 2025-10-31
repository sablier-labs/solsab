use crate::types::StreamData;
use solana_sdk::pubkey::Pubkey;
use trident_fuzz::fuzzing::*;

/// Get stream data from trident
pub fn get_stream_data_from_trident(trident: &mut Trident, stream_data_pubkey: &Pubkey) -> StreamData {
    get_stream_data_from_client(trident.get_client(), stream_data_pubkey)
}

/// Get stream data from client
pub fn get_stream_data_from_client(client: &mut impl FuzzClient, stream_data_pubkey: &Pubkey) -> StreamData {
    let stream_data_account = client.get_account(stream_data_pubkey);
    let data_without_discriminator = &stream_data_account.data()[8..];
    StreamData::try_from_slice(data_without_discriminator).expect("Failed to deserialize StreamData")
}
