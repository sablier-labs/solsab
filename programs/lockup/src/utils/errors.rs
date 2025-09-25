use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // -------------------------------------------------------------------------- //
    //                                COMMON ERRORS                               //
    // -------------------------------------------------------------------------- //
    #[msg("Can't perform the action on a depleted stream!")]
    StreamDepleted,

    // -------------------------------------------------------------------------- //
    //                                CANCEL STREAM                               //
    // -------------------------------------------------------------------------- //
    #[msg("Can't cancel an already-canceled Stream!")]
    StreamCanceled,
    #[msg("Can't cancel a non-cancelable Stream!")]
    StreamIsNotCancelable,
    #[msg("Can't cancel a settled Stream!")]
    StreamSettled,

    // -------------------------------------------------------------------------- //
    //                                COLLECT FEES                                //
    // -------------------------------------------------------------------------- //
    #[msg("Can't collect zero fees!")]
    CantCollectZeroFees,

    // -------------------------------------------------------------------------- //
    //                                CREATE STREAM                               //
    // -------------------------------------------------------------------------- //
    #[msg("Invalid cliff time of the Stream!")]
    CliffTimeNotLessThanEndTime,
    #[msg("Cliff time zero but unlock amount not zero!")]
    CliffTimeZeroUnlockAmountNotZero,
    #[msg("Invalid deposit amount!")]
    DepositAmountZero,
    #[msg("Start time must be less than cliff time!")]
    StartTimeNotLessThanCliffTime,
    #[msg("Start time must be less than end time!")]
    StartTimeNotLessThanEndTime,
    #[msg("Start time can't be zero!")]
    StartTimeZero,
    #[msg("Unlock amounts sum is greater than deposit amount!")]
    UnlockAmountsSumTooHigh,

    // -------------------------------------------------------------------------- //
    //                               RENOUNCE STREAM                              //
    // -------------------------------------------------------------------------- //
    #[msg("Can't renounce a non-cancelable Stream!")]
    StreamAlreadyNonCancelable,

    // -------------------------------------------------------------------------- //
    //                            WITHDRAW FROM STREAM                            //
    // -------------------------------------------------------------------------- //
    #[msg("Attempting to withdraw more than available in the stream!")]
    Overdraw,
    #[msg("Can't withdraw a zero amount!")]
    WithdrawAmountZero,
}
