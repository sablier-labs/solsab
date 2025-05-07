use anchor_lang::{prelude::*, solana_program::keccak::hashv as keccak_hashv};

use crate::utils::errors::ErrorCode;

pub fn check_claim(
    merkle_root: [u8; 32],
    claimer: Pubkey,
    leaf_id: u32,
    amount: u64,
    proof: &[[u8; 32]],
) -> Result<()> {
    // Form the leaf
    let leaf = [&leaf_id.to_le_bytes(), claimer.to_bytes().as_ref(), &amount.to_le_bytes()].concat();

    // Compute the hash of the leaf
    let mut leaf_hash = keccak_hashv(&[&leaf]).0;

    // Hash one more time to protect against the second pre-image attacks
    leaf_hash = keccak_hashv(&[&leaf_hash]).0;

    // Compute the root hash from the leaf hash and the proof
    // Dev: the below algorithm has been inspired by
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.0/contracts/cryptography/MerkleProof.sol
    let mut computed_root = leaf_hash;
    for proof_element in proof.iter() {
        if computed_root <= *proof_element {
            // Hash(current computed hash + current element of the proof)
            computed_root = keccak_hashv(&[&computed_root, proof_element]).0;
        } else {
            // Hash(current element of the proof + current computed hash)
            computed_root = keccak_hashv(&[proof_element, &computed_root]).0;
        }
    }
    // Check if the computed hash (root) is equal to the provided root
    if computed_root != merkle_root {
        return Err(ErrorCode::InvalidMerkleProof.into());
    }

    Ok(())
}

pub fn check_create_campaign(expiration_time: i64) -> Result<()> {
    // Check: the expiration date is strictly in the future.
    if expiration_time <= Clock::get()?.unix_timestamp {
        return Err(ErrorCode::ExpirationTimeNotInTheFuture.into());
    }

    Ok(())
}

pub fn check_clawback(clawback_amount: u64, campaign_ata_amount: u64, _expiration_time: i64) -> Result<()> {
    // Check: the clawback amount is not zero.
    if clawback_amount == 0 {
        return Err(ErrorCode::CantClawbackZeroAmount.into());
    }

    // Check: the clawback amount is less than or equal to the campaign ATA amount.
    if clawback_amount > campaign_ata_amount {
        return Err(ErrorCode::CantClawbackMoreThanRemaining.into());
    }

    // TODO: assert that the clawback is valid wrt the grace period and the expiration time

    Ok(())
}

pub fn check_collect_fees(collectable_amount: u64) -> Result<()> {
    // Check: the collectable amount is not zero.
    if collectable_amount == 0 {
        return Err(ErrorCode::CantCollectZeroFees.into());
    }

    Ok(())
}
