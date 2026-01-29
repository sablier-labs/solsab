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
    //                          CREATE TRANCHED STREAM                            //
    // -------------------------------------------------------------------------- //
    #[msg("Tranches array is empty!")]
    TranchesArrayEmpty,
    #[msg("Tranche timestamps must be in strictly ascending order!")]
    TranchesNotSorted,
    #[msg("Tranche amount must be greater than zero!")]
    TrancheAmountZero,
    #[msg("Stream start time must be strictly less than the first tranche's timestamp!")]
    StartTimeNotLessThanFirstTranche,
    #[msg("Tranche amounts and durations arrays must have same length!")]
    TrancheAmountsDurationsMismatch,
    #[msg("Too many tranches!")]
    TooManyTranches,
    #[msg("Tranche timestamp overflow!")]
    TrancheTimestampOverflow,
    #[msg("Tranche amounts sum overflow!")]
    TrancheAmountsSumOverflow,

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
