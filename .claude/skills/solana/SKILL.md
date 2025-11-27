---
name: solana
description:
  "This skill should be used when the user asks to build Solana programs, write Anchor code, create PDAs, work with SPL
  tokens, test Solana programs, or mentions Solana, Anchor, @solana/web3.js, @solana/kit, anchor-bankrun, Trident, or
  Solana blockchain development."
---

# Solana Program Development

Apply these principles when building production-grade Solana programs with Anchor.

## Core Architecture Principles

- **Account Model Mindset**: Data lives in accounts, not contracts. Programs are stateless executables that operate on
  accounts passed to them.
- **Rent Awareness**: All accounts must maintain rent-exempt balance (fixed SOL amount per byte). Use
  `#[derive(InitSpace)]` to calculate sizes accurately.
- **PDA Everything**: Use Program Derived Addresses for all program-owned accounts. Never use keypairs for state
  storage.
- **CPI Security**: Cross-program invocations inherit the caller's privileges. Validate all accounts before CPI calls.
- **Transaction Limits**: Stay within 1232 bytes per tx and 200k compute units default. See
  `references/TRANSACTIONS.md`.

## Tech Stack & Rationale

### Anchor (NOT Native Rust)

Use Anchor as the primary framework. Prefer it over native solana-program for:

- Account validation via declarative constraints (eliminates boilerplate)
- Automatic (de)serialization with Borsh
- IDL generation for TypeScript clients
- Built-in security checks (discriminators, ownership validation)

### Project Structure

Follow this organization pattern:

```
programs/{name}/src/
├── lib.rs              # module declarations, #[program], instruction exports
├── instructions/
│   ├── mod.rs          # re-exports all handlers
│   ├── *.rs            # state-changing Ixs; each has a #[derive(Accounts)] struct + handler()
│   └── view/           # read-only instructions (no state mutation)
│       └── *.rs
├── state/
│   ├── mod.rs
│   └── *.rs            # account structs representing the on-chain data stored by the program
└── utils/
    ├── mod.rs
    ├── errors.rs       # #[error_code] enum
    ├── events.rs       # #[event] structs
    ├── constants.rs    # various constants
    ├── validations.rs  # validation functions called during ix execution
    └── *.rs            # any other utilities
```

Documentation: https://www.anchor-lang.com/docs

## Program Development Patterns

### Account Struct Organization

Structure account validation in sections. Categories used in this codebase (Lockup & Merkle Instant programs):

| Category                   | Description                         | Examples                                                             |
| -------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| USER ACCOUNTS              | Transaction signers and their ATAs  | `sender: Signer`, `recipient: UncheckedAccount`, `sender_ata`        |
| SABLIER ACCOUNTS           | Global protocol state               | `treasury: Account<Treasury>`, `treasury_ata`                        |
| STREAM COLLECTION ACCOUNTS | NFT collection for ownership tokens | `stream_nft_collection: UncheckedAccount`                            |
| STREAM ACCOUNTS            | Per-stream state                    | `stream_data`, `stream_data_ata`, `stream_nft`, `deposit_token_mint` |
| CAMPAIGN ACCOUNTS          | Per-campaign state (Merkle Instant) | `campaign`, `campaign_ata`, `token_mint`                             |
| PROGRAM ACCOUNTS           | External programs                   | `mpl_core_program`, `token_program`, `associated_token_program`      |
| SYSTEM ACCOUNTS            | System-level accounts               | `system_program`                                                     |

Example from Lockup `create_with_timestamps.rs`:

```rust
#[derive(Accounts)]
pub struct CreateWithTimestampsLl<'info> {
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    // USER ACCOUNTS
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: The recipient may be any account.
    pub recipient: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = deposit_token_mint,
        associated_token::authority = sender,
        associated_token::token_program = deposit_token_program
    )]
    pub sender_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // ══════════════════════════════════════════════════════════════════════════════════════════════
    // STREAM COLLECTION ACCOUNTS
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    /// CHECK: Verified via constraint against the treasury's stored collection key.
    #[account(
        mut,
        address = treasury.stream_nft_collection @ LockupError::InvalidNftCollection,
    )]
    pub stream_nft_collection: UncheckedAccount<'info>,

    // ══════════════════════════════════════════════════════════════════════════════════════════════
    // STREAM ACCOUNTS
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    /// CHECK: Stream NFT (MPL Core asset)
    #[account(mut)]
    pub stream_nft: UncheckedAccount<'info>,

    #[account(
        init,
        payer = sender,
        space = ANCHOR_DISCRIMINATOR_SIZE + StreamData::INIT_SPACE,
        seeds = [Seed::STREAM_DATA, stream_nft.key().as_ref()],
        bump
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    #[account(
        init,
        payer = sender,
        associated_token::mint = deposit_token_mint,
        associated_token::authority = stream_data,
        associated_token::token_program = deposit_token_program
    )]
    pub stream_data_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mint::token_program = deposit_token_program)]
    pub deposit_token_mint: Box<InterfaceAccount<'info, Mint>>,

    // ══════════════════════════════════════════════════════════════════════════════════════════════
    // PROGRAM ACCOUNTS
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    pub deposit_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub mpl_core_program: Program<'info, MplCore>,

    // ══════════════════════════════════════════════════════════════════════════════════════════════
    // SYSTEM ACCOUNTS
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    pub system_program: Program<'info, System>,
}
```

### Handler Pattern

Keep handlers focused on business logic:

```rust
pub fn handler(ctx: Context<CreateStream>, salt: u128, amount: u64) -> Result<()> {
    // Validate inputs
    check_create(amount)?;

    // Update state
    ctx.accounts.stream_data.create(amount, salt)?;

    // Emit event
    emit!(StreamCreated { ... });

    Ok(())
}
```

### Error Handling

Use contextual error messages:

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Deposit amount must be greater than zero")]
    DepositAmountZero,
    #[msg("Start time must be less than end time")]
    InvalidTimeRange,
}
```

### Event Emission

Emit events for all state changes (critical for indexing):

```rust
#[event]
pub struct StreamCreated {
    pub stream_id: Pubkey,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}
```

### Key Patterns

- `Box<Account<>>` for any account that can be boxed
- `InterfaceAccount<TokenAccount>` for Token/Token2022 compatibility
- `UncheckedAccount` with `/// CHECK:` comments for flexible accounts
- Extract validation to the functions in `utils/validations.rs`

## Client Integration

### SDK Choice

- **@solana/kit** (new): Modular, tree-shakeable, better TypeScript support. Use for new projects.
- **@solana/web3.js** (legacy): More examples available, mature ecosystem. Use for existing projects.

See `references/CLIENT_SDKS.md` for detailed comparison and migration guidance.

## Testing Strategy

### Unit/Integration Tests

Use **Vitest + anchor-bankrun** (fast, deterministic):

```typescript
export class MyTestContext extends TestContext {
  async setUp() {
    await super.setUp(ProgramName.MyProgram, programId);
    // Program-specific setup
  }
}
```

See `references/TESTING.md` for patterns.

### Fuzz Testing

Use **Trident** for property-based fuzzing:

```
trident-tests/fuzz_{program}/
├── test_fuzz.rs
├── instructions/*.rs
└── helpers/{program}_math.rs
```

See `references/FUZZ_TESTING.md` for setup and patterns.

## Non-Negotiable Requirements

1. **Validate Account Ownership**: Always check `account.owner == expected_program`
2. **Use PDAs**: Never store state in keypair-controlled accounts
3. **Signer Checks**: Verify signers for all privileged operations
4. **Emit Events**: Every state change must emit an event for indexers
5. **Checked Math**: Use `checked_add`, `checked_sub`, `checked_mul` for all arithmetic, unless this is demonstrably not
   needed.

See `references/SECURITY.md` for comprehensive security checklist.

## Context7 Usage

Fetch latest documentation BEFORE implementation:

```
Use Context7 to get current Anchor, Solana, Metaplex and Trident documentation.
The ecosystem moves fast - don't assume yesterday's patterns still apply.
```
