use anchor_lang::{prelude::*, solana_program::keccak::hashv as keccak};

use crate::utils::errors::ErrorCode;

pub fn check_claim(
    amount: u64,
    expiration_time: i64,
    index: u32,
    merkle_proof: Vec<[u8; 32]>,
    merkle_root: [u8; 32],
    recipient: Pubkey,
    start_time: i64,
) -> Result<()> {
    // Check: the campaign has started.
    if !has_started(start_time)? {
        return Err(ErrorCode::CampaignNotStarted.into());
    }

    // Check: the campaign has not expired.
    if has_expired(expiration_time)? {
        return Err(ErrorCode::CampaignExpired.into());
    }

    let index_bytes = index.to_le_bytes();
    let recipient_bytes = recipient.to_bytes();
    let amount_bytes = amount.to_le_bytes();
    let leaf_bytes: &[&[u8]] = &[&index_bytes, &recipient_bytes, &amount_bytes];

    // Compute the hash of the leaf
    let mut leaf_hash = keccak(leaf_bytes).0;

    // Hash one more time to protect against the second pre-image attacks
    leaf_hash = keccak(&[&leaf_hash]).0;

    // Compute the root hash from the leaf hash and the merkle proof
    // Dev: the below algorithm has been inspired by
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.0/contracts/cryptography/MerkleProof.sol
    let mut computed_hash = leaf_hash;
    for proof_element in merkle_proof.iter() {
        if computed_hash <= *proof_element {
            // Hash(current computed hash + current element of the merkle proof)
            computed_hash = keccak(&[&computed_hash, proof_element]).0;
        } else {
            // Hash(current element of the merkle_proof + current computed hash)
            computed_hash = keccak(&[proof_element, &computed_hash]).0;
        }
    }
    // Check if the computed hash (root) is equal to the provided root
    if computed_hash != merkle_root {
        return Err(ErrorCode::InvalidMerkleProof.into());
    }

    Ok(())
}

pub fn check_clawback(expiration_time: i64, first_claim_time: i64) -> Result<()> {
    // Check: the grace period has not passed or the campaign has expired.
    if has_grace_period_passed(first_claim_time)? && !has_expired(expiration_time)? {
        return Err(ErrorCode::ClawbackNotAllowed.into());
    }

    Ok(())
}

pub fn check_collect_fees(collectable_amount: u64) -> Result<()> {
    // Check: the collectable amount is not zero.
    if collectable_amount == 0 {
        return Err(ErrorCode::CantCollectZeroFees.into());
    }

    Ok(())
}

pub fn check_create_campaign(expiration_time: i64, start_time: i64) -> Result<()> {
    // Check: the start time is strictly before the expiration time.
    if start_time >= expiration_time {
        return Err(ErrorCode::InvalidStartOrExpirationTime.into());
    }
    Ok(())
}

pub fn has_expired(expiration_time: i64) -> Result<bool> {
    let current_time = Clock::get()?.unix_timestamp;

    Ok(expiration_time > 0 && expiration_time <= current_time)
}

pub fn has_started(start_time: i64) -> Result<bool> {
    let current_time = Clock::get()?.unix_timestamp;

    Ok(start_time <= current_time)
}

pub fn has_grace_period_passed(first_claim_time: i64) -> Result<bool> {
    let current_time = Clock::get()?.unix_timestamp;
    let grace_period = 7 * 24 * 60 * 60; // 7 days in seconds

    Ok(first_claim_time > 0 && current_time > first_claim_time + grace_period)
}
