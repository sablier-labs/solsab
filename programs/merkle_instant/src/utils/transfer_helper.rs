use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, TransferChecked};

/// Helper function facilitating token transfer.
#[allow(clippy::too_many_arguments)]
pub fn transfer_tokens<'info>(
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    // Prepare the instruction to transfer the tokens
    let transfer_ix = TransferChecked { from, mint, to, authority };

    // Execute the transfer with the provided signer seeds
    let cpi_ctx = CpiContext::new_with_signer(token_program, transfer_ix, signer_seeds);

    transfer_checked(cpi_ctx, amount, decimals)?;

    Ok(())
}
