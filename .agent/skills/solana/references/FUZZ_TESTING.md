# Fuzz Testing with Trident

## Overview

**Trident** is a manually guided fuzzing framework for Solana Anchor programs. It generates randomized inputs to
discover edge cases that unit tests miss.

Docs: https://ackee.xyz/trident/docs/dev/

## Project Structure

```
trident-tests/
├── .cargo/config.toml      # Cargo configuration
├── Cargo.toml              # Dependencies
├── Trident.toml            # Fuzzing configuration
├── accounts/               # Mock account fixtures (JSON)
│   └── chainlink_sol_usd_feed_mock.json
└── fuzz_{program}/
    ├── test_fuzz.rs        # Entry point with flows
    ├── constants.rs        # Seeds, program IDs, timestamps
    ├── fuzz_accounts.rs    # FuzzAccounts storage struct
    ├── types.rs            # Shared types
    ├── instructions/
    │   ├── mod.rs
    │   └── {ix_name}.rs    # TridentInstruction for each ix
    ├── transactions/
    │   ├── mod.rs
    │   └── {ix_name}.rs    # Transaction builders
    ├── helpers/
    │   ├── mod.rs
    │   ├── {program}_math.rs  # Replicated math for invariants
    │   ├── accounts.rs     # Account deserialization helpers
    │   ├── balances.rs     # Balance tracking
    │   └── time.rs         # Time manipulation helpers
    ├── invariants.rs       # Post-execution invariant checks
    └── {feature}_assertions.rs  # Feature-specific assertions
```

## Configuration (Trident.toml)

```toml
[fuzz.metrics]
  enabled = true
  dashboard = true

[[fuzz.programs]]
  address = "YOUR_PROGRAM_ID"
  program = "../target/deploy/your_program.so"

[[fuzz.programs]]
  address = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  program = "../tests/fixtures/token_metadata_program.so"

[[fuzz.accounts]]
  address = "MOCK_ACCOUNT_ADDRESS"
  filename = "accounts/mock_account.json"
```

## Instruction Definition

```rust
// instructions/withdraw.rs
use trident_fuzz::fuzzing::*;

#[derive(TridentInstruction, Default)]
#[program_id("YOUR_PROGRAM_ID")]
#[discriminator([183u8, 18u8, 70u8, ...])]  // From IDL
pub struct WithdrawInstruction {
    pub accounts: WithdrawInstructionAccounts,
    pub data: WithdrawInstructionData,
}

#[derive(Debug, Clone, TridentAccounts, Default)]
#[instruction_data(WithdrawInstructionData)]
#[storage(FuzzAccounts)]
pub struct WithdrawInstructionAccounts {
    #[account(mut, signer)]
    pub signer: TridentAccount,

    #[account(mut, seeds = [TREASURY])]
    pub treasury: TridentAccount,

    #[account(address = "11111111111111111111111111111111")]
    pub system_program: TridentAccount,
    // ... other accounts
}

#[derive(Debug, BorshDeserialize, BorshSerialize, Clone, Default)]
pub struct WithdrawInstructionData {
    pub amount: u64,
}

impl InstructionHooks for WithdrawInstruction {
    type IxAccounts = FuzzAccounts;

    fn set_accounts(&mut self, trident: &mut Trident, fuzz_accounts: &mut Self::IxAccounts) {
        // Configure accounts with fuzzed values
    }

    fn set_data(&mut self, trident: &mut Trident, fuzz_accounts: &mut Self::IxAccounts) {
        // Generate fuzzed instruction data
        self.data.amount = trident.gen_range(1..u64::MAX);
    }
}
```

## Transaction Builder

```rust
// transactions/withdraw.rs
use trident_fuzz::fuzzing::*;

pub struct WithdrawTransaction {
    pub instruction: WithdrawInstruction,
}

impl TransactionBuilder for WithdrawTransaction {
    type Instruction = WithdrawInstruction;

    fn build(trident: &mut Trident, fuzz_accounts: &mut FuzzAccounts) -> Self {
        let mut instruction = WithdrawInstruction::default();
        instruction.set_accounts(trident, fuzz_accounts);
        instruction.set_data(trident, fuzz_accounts);
        Self { instruction }
    }
}
```

## Test Entry Point (test_fuzz.rs)

```rust
use trident_fuzz::fuzzing::*;

mod constants;
mod fuzz_accounts;
mod helpers;
mod instructions;
mod transactions;

use fuzz_accounts::*;
use transactions::*;

#[derive(FuzzTestMethods)]
struct FuzzTest {
    trident: Trident,
    fuzz_accounts: FuzzAccounts,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        Self {
            trident: Trident::default(),
            fuzz_accounts: FuzzAccounts::default(),
        }
    }

    #[init]
    fn start(&mut self) {
        // Initialize program state
        let mut tx = InitializeTransaction::build(&mut self.trident, &mut self.fuzz_accounts);
        self.trident.execute_transaction(&mut tx, Some("Initialize"));

        // Create test token mints
        self.fuzz_accounts.deposit_token_mint.get_or_create_mint_account(
            0,
            &mut self.trident,
            Some(PdaSeeds { seeds: &[], program_id: SPL_TOKEN_PROGRAM_ID }),
            6u8,
            &SPL_TOKEN_PROGRAM_ID,
            None,
        );

        // Warp to genesis time
        self.trident.get_client().warp_to_timestamp(GENESIS.try_into().unwrap());
    }

    #[flow]
    fn flow_withdraw(&mut self) {
        // Create stream first
        let (stream_accounts, _) = self.create_stream();

        // Probabilistically cancel before withdraw (50%)
        if self.trident.gen_range(0..2) == 0 {
            self.cancel(&stream_accounts);
        }

        // Withdraw
        self.withdraw(&stream_accounts);
    }

    #[flow]
    fn flow_cancel(&mut self) {
        let (stream_accounts, _) = self.create_stream();
        self.cancel(&stream_accounts);
    }

    #[end]
    fn end(&mut self) {}

    // Helper methods for building flows
    fn create_stream(&mut self) -> (CreateAccounts, CreateData) {
        let mut tx = CreateTransaction::build(&mut self.trident, &mut self.fuzz_accounts);
        self.trident.execute_transaction(&mut tx, Some("Create"));
        (tx.instruction.accounts, tx.instruction.data)
    }
}
```

### Account Helpers (helpers/accounts.rs)

```rust
use trident_fuzz::fuzzing::*;
use crate::types::StreamData;

pub fn get_stream_data_from_trident(trident: &mut Trident, stream_data_pubkey: &Pubkey) -> StreamData {
    let account = trident.get_client().get_account(stream_data_pubkey).unwrap();
    StreamData::try_from_slice(&account.data[8..]).expect("Failed to deserialize StreamData")
}

pub fn get_spl_ata_balance_from_data(data: &[u8]) -> u64 {
    // SPL token account balance is at offset 64 (8 bytes)
    u64::from_le_bytes(data[64..72].try_into().unwrap())
}
```

### Time Helpers (helpers/time.rs)

```rust
pub fn get_current_time_from_trident(trident: &mut Trident) -> u64 {
    trident.get_client().get_clock().unix_timestamp as u64
}

pub fn warp_to_a_random_future_time(trident: &mut Trident, stream_data_pubkey: &Pubkey) -> u64 {
    let stream_data = get_stream_data_from_trident(trident, stream_data_pubkey);
    let now = get_current_time_from_trident(trident);
    let warp_time = trident.gen_range(now..stream_data.timestamps.end + 86400);
    trident.get_client().warp_to_timestamp(warp_time.try_into().unwrap());
    warp_time
}
```

## Invariants Module (invariants.rs)

Centralized invariant validation across all transaction types:

```rust
use trident_fuzz::fuzzing::*;
use crate::{helpers::*, types::StreamData};

/// Universal invariants checked after every transaction
pub fn check_universal_invariants(
    stream_data: &TridentAccount,
    stream_data_ata: &TridentAccount,
    current_time: u64,
) {
    let stream_data_after = StreamData::try_from_slice(&stream_data.get_snapshot_after().data()[8..])
        .expect("Failed to deserialize StreamData");

    // Basic validity
    assert!(stream_data_after.amounts.deposited > 0, "Deposited > 0");
    assert!(stream_data_after.timestamps.end > stream_data_after.timestamps.start, "End > Start");
    assert!(stream_data_after.timestamps.start > 0, "Start > 0");

    // Balance conservation: ATA balance == deposited - refunded - withdrawn
    let ata_balance = get_spl_ata_balance_from_data(stream_data_ata.get_snapshot_after().data());
    let expected = stream_data_after.amounts.deposited
        .saturating_sub(stream_data_after.amounts.refunded)
        .saturating_sub(stream_data_after.amounts.withdrawn);
    assert_eq!(ata_balance, expected, "Balance conservation violated");

    // Amount bounds
    assert!(stream_data_after.amounts.deposited >= stream_data_after.amounts.withdrawn);
    assert!(stream_data_after.amounts.deposited >= stream_data_after.amounts.refunded);

    // State consistency
    assert!(!(stream_data_after.was_canceled && stream_data_after.is_cancelable));

    // State-specific checks
    if stream_data_after.was_canceled {
        check_canceled_stream(&stream_data_after, current_time);
    }
    if is_stream_depleted(&stream_data_after.amounts) {
        check_depleted_stream(&stream_data_after, current_time);
    }
}

fn check_canceled_stream(stream_data: &StreamData, current_time: u64) {
    assert!(!stream_data.is_cancelable, "Canceled stream should not be cancelable");
    assert!(stream_data.amounts.refunded > 0, "Canceled stream must have refund > 0");

    let refundable = get_refundable_amount(
        &stream_data.timestamps, &stream_data.amounts,
        stream_data.is_cancelable, stream_data.is_depleted, stream_data.was_canceled, current_time
    );
    assert_eq!(refundable, 0, "Canceled stream refundable must be 0");
}

fn check_depleted_stream(stream_data: &StreamData, current_time: u64) {
    assert!(!stream_data.is_cancelable, "Depleted stream should not be cancelable");
    assert!(stream_data.is_depleted, "Stream should be marked depleted");
    assert_eq!(stream_data.amounts.refunded, 0, "Depleted stream refund must be 0");

    let withdrawable = get_withdrawable_amount(
        &stream_data.timestamps, &stream_data.amounts,
        stream_data.is_depleted, stream_data.was_canceled, current_time
    );
    assert_eq!(withdrawable, 0, "Depleted stream withdrawable must be 0");
}

/// Create-specific invariants
pub fn check_create_invariants(creator_ata: &TridentAccount, stream_data_ata: &TridentAccount) {
    let before = get_spl_ata_balance_from_data(creator_ata.get_snapshot_before().data());
    let after = get_spl_ata_balance_from_data(creator_ata.get_snapshot_after().data());
    let stream_balance = get_spl_ata_balance_from_data(stream_data_ata.get_snapshot_after().data());

    assert_eq!(before, after + stream_balance, "Token transfer invariant violated");
}
```

## Types Module (types.rs)

```rust
use borsh::{BorshDeserialize, BorshSerialize};
use solana_sdk::pubkey::Pubkey;

#[derive(Debug, Clone, BorshDeserialize, BorshSerialize)]
pub struct StreamData {
    pub bump: u8,
    pub sender: Pubkey,
    pub nft_mint: Pubkey,
    pub recipient: Pubkey,
    pub token_mint: Pubkey,
    pub is_cancelable: bool,
    pub is_transferable: bool,
    pub is_depleted: bool,
    pub was_canceled: bool,
    pub amounts: Amounts,
    pub timestamps: Timestamps,
}

#[derive(Debug, Clone, BorshDeserialize, BorshSerialize)]
pub struct Amounts {
    pub deposited: u64,
    pub withdrawn: u64,
    pub refunded: u64,
    pub start_unlock: u64,
    pub cliff_unlock: u64,
}

#[derive(Debug, Clone, BorshDeserialize, BorshSerialize)]
pub struct Timestamps {
    pub start: u64,
    pub cliff: u64,
    pub end: u64,
}
```

## Running Fuzz Tests

```bash
# Build programs first
just build

# Run fuzz tests
just fuzz
```

## Best Practices

1. **Guide the fuzzer** - Don't rely on random inputs; specify valid ranges and sequences
2. **Test realistic flows** - Combine instructions as users would (create → withdraw → cancel)
3. **Replicate program math** - Mirror calculations for invariant verification
4. **Use time warping** - Test different temporal states (before start, during, after end)
5. **Assert invariants** - Check balance conservation, state consistency
6. **Label transactions** - Use descriptive labels for debugging crashes
