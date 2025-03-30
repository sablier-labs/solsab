use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Can't collect zero fees!")]
    CantCollectZeroFees,
    #[msg("Can't renounce a non-cancelable Stream!")]
    CantRenounceANonCancelableStream,
    #[msg("Can't withdraw from a depleted Stream!")]
    CantWithdrawFromADepletedStream,
    #[msg("Deposit amount is less than the unlock amounts!")]
    DepositAmountLessThanUnlockAmounts,
    #[msg("Invalid cliff time of the Stream!")]
    InvalidCliffTime,
    #[msg("Invalid cliff unlock amount!")]
    InvalidCliffUnlockAmount,
    #[msg("Invalid deposit amount!")]
    DepositAmountCantBeZero,
    #[msg("Stream end time cannot be in the past!")]
    InvalidEndTime,
    #[msg("Invalid withdrawal amount!")]
    InvalidWithdrawalAmount,
    #[msg("The Total Supply of the NFT Collection has overflowed!")]
    NftCollectionTotalSupplyOverflow,
    #[msg("Not enough fees for withdrawal!")]
    NotEnoughFeesForWithdrawal,
    #[msg("Rent exemption doubling has failed!")]
    RentExemptionDoublingFailed,
    #[msg("Can't cancel a non-cancelable Stream!")]
    StreamIsNotCancelable,
    #[msg("Can't withdraw a zero amount!")]
    WithdrawalAmountCannotBeZero,
}
