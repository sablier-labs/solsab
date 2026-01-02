use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize};

use crate::utils::errors::ErrorCode;

// ============================================================================
//                               CONSTANTS
// ============================================================================

/// Maximum number of tranches per stream (constrained by the tx size/CU limits).
pub const MAX_TRANCHES: usize = 50;

// ============================================================================
//                            SHARED TYPES
// ============================================================================

/// Common amounts for all stream models.
///
/// These fields are model-agnostic and track the fundamental token amounts:
/// - `deposited`: The total amount of tokens locked into the stream at creation time.
/// - `refunded`: The amount of tokens returned to the sender on cancellation.
/// - `withdrawn`: The amount of tokens already claimed by the recipient.
#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Amounts {
    pub deposited: u64,
    pub refunded: u64,
    pub withdrawn: u64,
}

// ============================================================================
//                            LINEAR MODEL TYPES
// ============================================================================

/// Linear stream unlock amounts.
#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct LinearUnlocks {
    /// Amount unlocked at `start` time.
    pub start: u64,
    /// Amount unlocked at `cliff` time.
    pub cliff: u64,
}

/// Linear stream timestamps.
#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct LinearTimestamps {
    /// Stream start time (must be > 0).
    pub start: u64,
    /// Cliff time (0 = no cliff; if > 0: start < cliff < end).
    pub cliff: u64,
    /// Stream end time (must be > start and > cliff if cliff > 0).
    pub end: u64,
}

// ============================================================================
//                           TRANCHED MODEL TYPES
// ============================================================================

/// Single tranche with amount and unlock timestamp.
///
/// Each tranche represents a discrete unlock event. The `amount` becomes
/// withdrawable once the `timestamp` is reached.
#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct Tranche {
    /// Tokens unlocked at this tranche.
    pub amount: u64,
    /// Unix timestamp for when this tranche unlocks.
    pub timestamp: u64,
}

/// Tranched stream timestamps.
#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub struct TranchedTimestamps {
    /// Stream start time (must be < first tranche timestamp).
    pub start: u64,
    /// The timestamp of the last tranche.
    pub end: u64,
}

// ============================================================================
//                             STREAM MODEL
// ============================================================================

/// Stream unlock model with model-specific data.
///
/// This enum encapsulates all of the model-specific state, allowing the common
/// `StreamData` struct to handle both linear and tranched streams uniformly.
#[derive(Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub enum StreamModel {
    Linear {
        timestamps: LinearTimestamps,
        unlocks: LinearUnlocks,
    },
    Tranched {
        timestamps: TranchedTimestamps,
        #[max_len(MAX_TRANCHES)]
        tranches: Vec<Tranche>,
    },
}

// ============================================================================
//                             STREAM DATA
// ============================================================================

/// The account storing the data for both linear and tranched streams.
///
/// This unified struct handles all stream types through the `model` field
/// which discriminates between linear and tranched unlock schedules.
#[account]
#[derive(InitSpace)]
pub struct StreamData {
    pub amounts: Amounts,
    pub deposited_token_mint: Pubkey,
    pub bump: u8,
    pub salt: u128,
    pub is_cancelable: bool,
    pub is_depleted: bool,
    pub sender: Pubkey,
    pub was_canceled: bool,
    pub model: StreamModel,
}

impl StreamData {
    // ========================================================================
    //                         LINEAR STREAM METHODS
    // ========================================================================

    /// State update for the [`fn@crate::sablier_lockup::cancel`] instruction.
    #[allow(clippy::too_many_arguments)]
    pub fn create_linear(
        &mut self,
        deposited_token_mint: Pubkey,
        bump: u8,
        deposit_amount: u64,
        salt: u128,
        is_cancelable: bool,
        sender: Pubkey,
        start_time: u64,
        cliff_time: u64,
        end_time: u64,
        start_unlock_amount: u64,
        cliff_unlock_amount: u64,
    ) -> Result<()> {
        self.amounts = Amounts {
            deposited: deposit_amount,
            refunded: 0,
            withdrawn: 0,
        };
        self.deposited_token_mint = deposited_token_mint;
        self.bump = bump;
        self.salt = salt;
        self.is_cancelable = is_cancelable;
        self.is_depleted = false;
        self.sender = sender;
        self.was_canceled = false;
        self.model = StreamModel::Linear {
            timestamps: LinearTimestamps {
                start: start_time,
                cliff: cliff_time,
                end: end_time,
            },
            unlocks: LinearUnlocks {
                start: start_unlock_amount,
                cliff: cliff_unlock_amount,
            },
        };

        Ok(())
    }

    // ========================================================================
    //                        TRANCHED STREAM METHODS
    // ========================================================================

    /// State update for the [`fn@crate::sablier_lockup::create_with_timestamps_ll`] instruction.
    #[allow(clippy::too_many_arguments)]
    pub fn create_tranched(
        &mut self,
        deposited_token_mint: Pubkey,
        bump: u8,
        deposit_amount: u64,
        salt: u128,
        is_cancelable: bool,
        sender: Pubkey,
        start_time: u64,
        tranches: Vec<Tranche>,
    ) -> Result<()> {
        let end_time = tranches.last().ok_or(ErrorCode::TranchesEmpty)?.timestamp;

        self.amounts = Amounts {
            deposited: deposit_amount,
            refunded: 0,
            withdrawn: 0,
        };
        self.deposited_token_mint = deposited_token_mint;
        self.bump = bump;
        self.salt = salt;
        self.is_cancelable = is_cancelable;
        self.is_depleted = false;
        self.sender = sender;
        self.was_canceled = false;
        self.model = StreamModel::Tranched {
            timestamps: TranchedTimestamps {
                start: start_time,
                end: end_time,
            },
            tranches,
        };

        Ok(())
    }

    // ========================================================================
    //                          SHARED METHODS
    // ========================================================================

    /// State update for canceling a stream.
    pub fn cancel(&mut self, sender_amount: u64, recipient_amount: u64) -> Result<()> {
        self.amounts.refunded = sender_amount;
        self.is_cancelable = false;
        if recipient_amount == 0 {
            self.is_depleted = true;
        }
        self.was_canceled = true;

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
