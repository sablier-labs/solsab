use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize};

#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Amounts {
    pub start_unlock: u64,
    pub cliff_unlock: u64,
    pub deposited: u64,
    pub refunded: u64,
    pub withdrawn: u64,
}

#[account]
#[derive(InitSpace)]
pub struct StreamData {
    pub amounts: Amounts,
    pub deposited_token_mint: Pubkey,
    pub bump: u8,
    pub salt: u128,
    pub is_cancelable: bool,
    pub is_depleted: bool,
    pub timestamps: Timestamps,
    pub sender: Pubkey,
    pub was_canceled: bool,
    pub nft_address: Pubkey,
}

/// Groups the timestamps for a Lockup stream.
#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Timestamps {
    pub cliff: u64,
    pub end: u64,
    pub start: u64,
}

impl StreamData {
    /// State update for the [`fn@crate::sablier_lockup::cancel`] instruction.
    pub fn cancel(&mut self, sender_amount: u64, recipient_amount: u64) -> Result<()> {
        self.amounts.refunded = sender_amount;
        self.is_cancelable = false;
        if recipient_amount == 0 {
            self.is_depleted = true;
        }
        self.was_canceled = true;

        Ok(())
    }

    /// State update for the [`fn@crate::sablier_lockup::create_with_timestamps_ll`] instruction.
    #[allow(clippy::too_many_arguments)]
    pub fn create(
        &mut self,
        deposited_token_mint: Pubkey,
        bump: u8,
        cliff_time: u64,
        cliff_unlock_amount: u64,
        deposit_amount: u64,
        end_time: u64,
        salt: u128,
        is_cancelable: bool,
        sender: Pubkey,
        start_time: u64,
        start_unlock_amount: u64,
    ) -> Result<()> {
        self.bump = bump;
        self.amounts = Amounts {
            cliff_unlock: cliff_unlock_amount,
            deposited: deposit_amount,
            refunded: 0,
            start_unlock: start_unlock_amount,
            withdrawn: 0,
        };
        self.deposited_token_mint = deposited_token_mint;
        self.is_cancelable = is_cancelable;
        self.is_depleted = false;
        self.salt = salt;
        self.sender = sender;
        self.timestamps = Timestamps {
            cliff: cliff_time,
            end: end_time,
            start: start_time,
        };
        self.was_canceled = false;

        Ok(())
    }

    /// State update for the [`fn@crate::sablier_lockup::renounce`] instruction.
    pub fn renounce(&mut self) -> Result<()> {
        self.is_cancelable = false;

        Ok(())
    }

    /// State update for the [`fn@crate::sablier_lockup::withdraw`] instruction.
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        self.amounts.withdrawn = self.amounts.withdrawn.checked_add(amount).expect("Withdrawn amount overflow");

        // Mark the Stream as non-cancelable if it has been depleted
        //
        // Note: the `>=` operator is used as an extra safety measure for the case when the withdrawn amount is bigger
        // than expected, for one reason or the other
        if self.amounts.withdrawn >= self.amounts.deposited - self.amounts.refunded {
            self.is_cancelable = false;
            self.is_depleted = true;
        }

        Ok(())
    }
}
