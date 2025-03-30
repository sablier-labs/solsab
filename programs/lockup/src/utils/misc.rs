use anchor_lang::prelude::*;

use crate::state::lockup::StreamData;

pub fn mark_stream_as_depleted(stream_data: &mut Account<StreamData>) {
    // Mark the Stream as depleted
    stream_data.is_depleted = true;

    // Mark the Stream as non-cancelable (which is a side-effect of the deplition)
    stream_data.is_cancelable = false;
}
