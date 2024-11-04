use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Can't cancel a Stream that's already canceled!")]
    StreamIsAlreadyCanceled,
    #[msg("Can't cancel a non-cancelable Stream!")]
    StreamIsNotCancelable,
    #[msg("Can't renounce an already-renounced Stream!")]
    StreamCancelabilityIsAlreadyRenounced,
}
