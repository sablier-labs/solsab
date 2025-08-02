use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // -------------------------------------------------------------------------- //
    //                                CLAIM ERRORS                                //
    // -------------------------------------------------------------------------- //
    #[msg("Campaign has expired!")]
    CampaignExpired,
    #[msg("Invalid Merkle proof!")]
    InvalidMerkleProof,
    #[msg("Campaign has not started yet!")]
    CampaignNotStarted,

    // -------------------------------------------------------------------------- //
    //                               CLAWBACK ERRORS                              //
    // -------------------------------------------------------------------------- //
    #[msg("Clawback not allowed past the grace period and before campaign expiration!")]
    ClawbackNotAllowed,

    // -------------------------------------------------------------------------- //
    //                             COLLECT FEES ERRORS                            //
    // -------------------------------------------------------------------------- //
    #[msg("Can't collect zero fees!")]
    CantCollectZeroFees,
}
