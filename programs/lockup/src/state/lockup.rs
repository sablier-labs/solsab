use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize};

#[account]
#[derive(InitSpace)]
pub struct StreamData {
    pub amounts: Amounts,
    pub deposit_token_mint: Pubkey,
    pub bump: u8,
    pub stream_id: u64,
    pub nft_id: u64,
    pub is_cancelable: bool,
    pub is_depleted: bool,
    pub timestamps: Timestamps,
    pub sender: Pubkey,
    pub was_canceled: bool,
}

#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Amounts {
    pub start_unlock: u64,
    pub cliff_unlock: u64,
    pub deposited: u64,
    pub refunded: u64,
    pub withdrawn: u64,
}

#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Timestamps {
    pub cliff_time: i64,
    pub end_time: i64,
    pub start_time: i64,
}

impl StreamData {
    /// State update for the `cancel` instruction.
    pub fn cancel(&mut self, sender_amount: u64, recipient_amount: u64) -> Result<()> {
        self.amounts.refunded = sender_amount;
        self.is_cancelable = false;
        if recipient_amount == 0 {
            self.is_depleted = true;
        }
        self.was_canceled = true;

        Ok(())
    }

    /// State update for the `create_with_timestamps` instruction.
    #[allow(clippy::too_many_arguments)]
    pub fn create(
        &mut self,
        deposit_token_mint: Pubkey,
        bump: u8,
        cliff_time: i64,
        cliff_unlock: u64,
        deposited: u64,
        end_time: i64,
        stream_id: u64,
        nft_id: u64,
        is_cancelable: bool,
        sender: Pubkey,
        start_time: i64,
        start_unlock: u64,
    ) -> Result<()> {
        self.bump = bump;
        self.amounts.cliff_unlock = cliff_unlock;
        self.amounts.deposited = deposited;
        self.amounts.refunded = 0;
        self.amounts.start_unlock = start_unlock;
        self.amounts.withdrawn = 0;
        self.deposit_token_mint = deposit_token_mint;
        self.stream_id = stream_id;
        self.nft_id = nft_id;
        self.is_cancelable = is_cancelable;
        self.is_depleted = false;
        self.sender = sender;
        self.timestamps.cliff_time = cliff_time;
        self.timestamps.end_time = end_time;
        self.timestamps.start_time = start_time;
        self.was_canceled = false;

        Ok(())
    }

    /// State update for the `renounce` instruction.
    pub fn renounce(&mut self) -> Result<()> {
        self.is_cancelable = false;

        Ok(())
    }

    /// State update for the `withdraw` instruction.
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
