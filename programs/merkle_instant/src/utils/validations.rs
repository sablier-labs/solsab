use anchor_lang::{prelude::*, solana_program::keccak::hashv as keccak_hashv};

use crate::utils::errors::ErrorCode;

pub fn check_claim(
    expiration_time: i64,
    merkle_root: [u8; 32],
    index: u32,
    recipient: Pubkey,
    amount: u64,
    merkle_proof: &[[u8; 32]],
) -> Result<()> {
    // Check: the campaign has not expired.
    if has_expired(expiration_time)? {
        return Err(ErrorCode::CampaignExpired.into());
    }

    // Form the leaf
    let leaf = [&index.to_le_bytes(), recipient.to_bytes().as_ref(), &amount.to_le_bytes()].concat();

    // Compute the hash of the leaf
    let mut leaf_hash = keccak_hashv(&[&leaf]).0;

    // Hash one more time to protect against the second pre-image attacks
    leaf_hash = keccak_hashv(&[&leaf_hash]).0;

    // Compute the root hash from the leaf hash and the merkle_proof
    // Dev: the below algorithm has been inspired by
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.0/contracts/cryptography/merkle_proof.sol
    let mut computed_hash = leaf_hash;
    for proof_element in merkle_proof.iter() {
        if computed_hash <= *proof_element {
            // Hash(current computed hash + current element of the merkle_proof)
            computed_hash = keccak_hashv(&[&computed_hash, proof_element]).0;
        } else {
            // Hash(current element of the merkle_proof + current computed hash)
            computed_hash = keccak_hashv(&[proof_element, &computed_hash]).0;
        }
    }
    // Check if the computed hash (root) is equal to the provided root
    if computed_hash != merkle_root {
        return Err(ErrorCode::InvalidMerkleProof.into());
    }

    Ok(())
}

pub fn check_clawback(expiration_time: i64, first_claim_time: i64) -> Result<()> {
    // Check: the grace period has passed and the campaign has not expired.
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

pub fn has_expired(expiration_time: i64) -> Result<bool> {
    let current_time = Clock::get()?.unix_timestamp;

    Ok(expiration_time > 0 && expiration_time <= current_time)
}

pub fn has_grace_period_passed(first_claim_time: i64) -> Result<bool> {
    let current_time = Clock::get()?.unix_timestamp;
    let grace_period = 7 * 24 * 60 * 60; // 7 days in seconds

    Ok(first_claim_time > 0 && current_time > first_claim_time + grace_period)
}
