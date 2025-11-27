# Solana Account Model

## Core Concepts

Solana uses an **account-based model** where all state is stored in accounts. Programs are stateless - they only contain
executable code and operate on accounts passed to them.

### Account Structure

Every account has:

```
┌─────────────────────────────────────┐
│ lamports: u64      (balance)        │
│ data: Vec<u8>      (arbitrary data) │
│ owner: Pubkey      (program owner)  │
│ executable: bool   (is program?)    │
│ rent_epoch: u64    (rent tracking)  │
└─────────────────────────────────────┘
```

### Key Rules

1. **Only the owner can modify `data`** - Programs can only write to accounts they own
2. **Anyone can credit lamports** - But only owner can debit
3. **Programs are accounts too** - With `executable: true`
4. **System Program owns new accounts** - Until transferred to another program

## Rent & Rent Exemption

Accounts must maintain a minimum lamport balance to exist on-chain. This **rent-exempt balance** is a fixed amount per
byte of account data:

```rust
// Minimum balance for rent exemption
let rent = Rent::get()?;
let min_balance = rent.minimum_balance(account_size);
```

Accounts below this threshold are garbage collected by the runtime.

### Calculating Account Size

Use `#[derive(InitSpace)]` in Anchor:

```rust
#[account]
#[derive(InitSpace)]
pub struct StreamData {
    pub sender: Pubkey,           // 32 bytes
    pub recipient: Pubkey,        // 32 bytes
    pub amount: u64,              // 8 bytes
    pub bump: u8,                 // 1 byte
    #[max_len(32)]
    pub name: String,             // 4 + 32 bytes (prefix + max length)
}

// In account constraint:
#[account(
    init,
    payer = sender,
    space = 8 + StreamData::INIT_SPACE,  // 8 = discriminator
    seeds = [...],
    bump
)]
```

## Program Derived Addresses (PDAs)

PDAs are deterministic addresses derived from seeds + program ID. They have **no private key** - only the program can
sign for them.

### Derivation

```rust
// Finding a PDA
let (pda, bump) = Pubkey::find_program_address(
    &[b"stream", user.key().as_ref(), &salt.to_le_bytes()],
    program_id
);

// In Anchor constraints
#[account(
    seeds = [b"stream", user.key().as_ref(), &salt.to_le_bytes()],
    bump = stream_data.bump  // Store bump for efficient re-derivation
)]
pub stream_data: Account<'info, StreamData>,
```

### Seed Patterns

Organize seeds in a constants module:

```rust
// utils/constants.rs
pub mod seeds {
    pub const TREASURY: &[u8] = b"treasury";
    pub const STREAM_DATA: &[u8] = b"stream_data";
    pub const USER_STATE: &[u8] = b"user_state";
}

// Usage
#[account(
    seeds = [seeds::STREAM_DATA, nft_mint.key().as_ref()],
    bump = stream_data.bump
)]
```

### PDA Best Practices

1. **Always store the bump** - Avoids recomputation on every call
2. **Use meaningful seeds** - Make PDAs queryable client-side
3. **Include unique identifiers** - Prevent collisions (salt, user pubkey, etc.)
4. **Document seed structure** - Critical for client integration

## Account Creation

### Via System Program

```rust
// Creating account via CPI
invoke(
    &system_instruction::create_account(
        payer.key,
        new_account.key,
        rent_lamports,
        space as u64,
        owner_program_id,
    ),
    &[payer.clone(), new_account.clone()],
)?;
```

### Via Anchor (Recommended)

```rust
#[account(
    init,
    payer = sender,
    space = 8 + MyAccount::INIT_SPACE,
    seeds = [b"my_account", sender.key().as_ref()],
    bump
)]
pub my_account: Account<'info, MyAccount>,
```

## Account Validation

### Ownership Checks

```rust
// Anchor handles this automatically for Account<> types
// For UncheckedAccount, verify manually:
require!(
    account.owner == &expected_program_id,
    ErrorCode::InvalidOwner
);
```

### Discriminator

Anchor adds an 8-byte discriminator to prevent account type confusion:

```rust
// First 8 bytes of SHA256("account:MyAccountName")
// Anchor validates this automatically
```

## Common Patterns

### Closing Accounts

```rust
#[account(
    mut,
    close = destination,  // Lamports transferred to destination
    seeds = [...],
    bump
)]
pub account_to_close: Account<'info, MyAccount>,
```

### Reallocation

```rust
#[account(
    mut,
    realloc = 8 + NewSize::INIT_SPACE,
    realloc::payer = payer,
    realloc::zero = false,  // Don't zero new space
)]
pub growing_account: Account<'info, GrowingData>,
```
