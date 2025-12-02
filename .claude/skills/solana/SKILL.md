---
name: solana
description: This skill should be used when the user asks to "build a Solana program", "write Anchor code", "create a
  PDA", "work with SPL tokens", "test with anchor-bankrun", "fuzz test with Trident", "secure my Solana program",
  "create an NFT with MPL Core", "optimize compute units", or mentions Anchor constraints, account validation, CPI
  patterns, @solana/web3.js, @solana/kit, Vitest testing, or Solana security auditing. # prettier-ignore
version: 0.1.0
---

# Solana Program Development

You are a senior Solana Anchor engineer with extensive experience using the Anchor CLI, Solana CLI, Metaplex NFTs, and
Trident-based fuzz testing.

Production-grade Solana development with Anchor, covering program architecture, testing, and security.

## Core Architecture

**Account Model Mindset**: Data lives in accounts, not contracts. Programs are stateless executables operating on
accounts passed to them. Consult `references/ACCOUNT_MODEL.md` for PDA patterns and rent calculations.

**Critical Constraints**:

- Maintain rent-exempt balance for all accounts (use `#[derive(InitSpace)]`)
- Derive all program-owned accounts as PDAs—never keypairs for state
- Validate all accounts before CPI calls (inherits caller's privileges)
- Stay within 1232 bytes/tx and 200k CU default (consult `references/TRANSACTIONS.md`)

## Tech Stack

### Anchor Framework

Anchor is the primary framework. Prefer over native solana-program for:

- Declarative account validation via constraints
- Automatic Borsh (de)serialization
- IDL generation for TypeScript clients
- Built-in security checks (discriminators, ownership validation)

### Project Structure

```
programs/{name}/src/
├── lib.rs              # module declarations, #[program], instruction exports
├── instructions/
│   ├── mod.rs          # re-exports all handlers
│   ├── *.rs            # state-changing Ixs with #[derive(Accounts)] + handler()
│   └── view/           # read-only instructions (no state mutation)
├── state/              # account structs for on-chain data
└── utils/
    ├── errors.rs       # #[error_code] enum
    ├── events.rs       # #[event] structs
    ├── constants.rs    # seeds, program IDs
    └── validations.rs  # validation functions
```

## Program Development Patterns

### Account Struct Organization

Structure account validation in logical sections (see `create_with_timestamps.rs`, `claim.rs`):

| Category            | Description                            | Examples                                      |
| ------------------- | -------------------------------------- | --------------------------------------------- |
| USER ACCOUNTS       | Signers and their ATAs                 | `creator: Signer`, `creator_ata`, `recipient` |
| PROTOCOL ACCOUNTS   | Global protocol state (treasury, etc.) | `treasury: Account<Treasury>`                 |
| COLLECTION ACCOUNTS | NFT collection state (if applicable)   | `nft_collection_data`, `nft_collection_mint`  |
| ENTITY ACCOUNTS     | Per-entity state (streams, campaigns)  | `stream_data`, `stream_data_ata`, `campaign`  |
| PROGRAM ACCOUNTS    | External programs                      | `token_program`, `associated_token_program`   |
| SYSTEM ACCOUNTS     | System-level                           | `system_program`, `rent`                      |

Key account type patterns:

```rust
#[derive(Accounts)]
#[instruction(salt: u128)]
pub struct CreateWithTimestamps<'info> {
    // USER ACCOUNTS
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = deposit_token_mint,
        associated_token::authority = creator,
        associated_token::token_program = deposit_token_program
    )]
    pub creator_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: The recipient may be any account
    pub recipient: UncheckedAccount<'info>,

    // ENTITY ACCOUNTS
    #[account(
        init,
        payer = creator,
        space = 8 + StreamData::INIT_SPACE,
        seeds = [STREAM_DATA, stream_nft_mint.key().as_ref()],
        bump
    )]
    pub stream_data: Box<Account<'info, StreamData>>,

    // Token2022-compatible
    pub deposit_token_program: Interface<'info, TokenInterface>,
}
```

### Handler Pattern

Structure handlers with validation first, then state updates and interactions, then event emission:

```rust
pub fn handler(ctx: Context<CreateWithTimestamps>, deposit_amount: u64, ...) -> Result<()> {
    // Validate parameters
    check_create(deposit_amount, start_time, cliff_time, end_time, ...)?;

    // Update state
    ctx.accounts.stream_data.create(...)?;

    // Transfer tokens
    transfer_tokens(creator_ata, stream_data_ata, creator, ...)?;

    // Emit event for indexers
    emit!(CreateLockupLinearStream { salt, deposit_token_mint, ... });

    Ok(())
}
```

### Key Patterns

| Pattern                           | When to Use                              |
| --------------------------------- | ---------------------------------------- |
| `Box<Account<>>`                  | Large accounts to reduce stack usage     |
| `InterfaceAccount<TokenAccount>`  | Token/Token2022 compatibility            |
| `UncheckedAccount` + `/// CHECK`  | Flexible validation (document the check) |
| Extract to `utils/validations.rs` | Reusable validation logic                |

### Events & Errors

Emit events for all state changes (critical for indexers). Define contextual error messages:

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Deposit amount must be greater than zero")]
    DepositAmountZero,
}

#[event]
pub struct StreamCreated { pub stream_id: Pubkey, pub amount: u64 }
```

## Client Integration

| SDK                 | Use Case               | Notes                           |
| ------------------- | ---------------------- | ------------------------------- |
| `@solana/kit`       | New projects           | Modular, tree-shakeable         |
| `@solana/web3.js`   | Existing projects      | Mature ecosystem, more examples |
| `@coral-xyz/anchor` | Anchor program clients | IDL-based type-safe calls       |

Consult `references/CLIENT_SDKS.md` for detailed comparison and migration patterns.

## Testing Strategy

### Unit/Integration Tests (Vitest + anchor-bankrun)

Fast, deterministic testing without validator startup. Key pattern:

```typescript
class LockupTestContext extends TestContext {
  async setUp() {
    await super.setUp("sablier_lockup", programId);
    this.program = new Program<SablierLockup>(IDL, this.provider);
  }
}
```

Consult `references/TESTING.md` for complete test context patterns, time travel, and assertions.

### Fuzz Testing (Trident)

Property-based fuzzing for edge case discovery:

```
trident-tests/fuzz_{program}/
├── test_fuzz.rs          # Entry point with flows
├── instructions/*.rs     # TridentInstruction definitions
└── helpers/*_math.rs     # Replicated math for invariants
```

Consult `references/FUZZ_TESTING.md` for instruction hooks, invariants, and time warping.

## Security Requirements

Non-negotiable security practices:

1. **Account Ownership**: Validate `account.owner == expected_program` (automatic for `Account<>`)
2. **PDAs Only**: Never store state in keypair-controlled accounts
3. **Signer Checks**: Verify signers for all privileged operations
4. **Event Emission**: Every state change must emit an event for indexers
5. **Checked Math**: Use `checked_add`, `checked_sub`, `checked_mul` for all arithmetic

Consult `references/SECURITY.md` for comprehensive vulnerability patterns and audit checklist.

## MPL Core (NFTs)

For NFT ownership tokens, Metaplex Core provides efficient single-account NFTs (~0.0029 SOL vs ~0.022 SOL for Token
Metadata).

Consult `references/MPL_CORE.md` for CPI builders and collection patterns.

## Build & Code Generation

Building programs automatically generates TypeScript bindings:

```bash
just build           # Build all programs + generate TS types
just build sablier_lockup  # Build specific program
```

The build process:

1. `anchor build` → compiles Rust → generates `target/idl/{program}.json`
2. `just codegen` → generates `target/types/{program}_errors.ts` and `{program}_structs.ts`

Generated types provide type-safe access to on-chain data in tests:

```typescript
import type { StreamData } from "../target/types/sablier_lockup_structs";
import { ProgramErrorCode } from "../target/types/sablier_lockup_errors";

const streamData: StreamData = await program.account.streamData.fetch(pda);
await expectToThrow(ctx.withdraw(), ProgramErrorCode.StreamDepleted);
```

Consult `references/CODEGEN.md` for type mappings, script architecture and troubleshooting.

---

## Additional Resources

### Reference Files

Detailed documentation for specific domains:

| File                          | Content                                       |
| ----------------------------- | --------------------------------------------- |
| `references/ACCOUNT_MODEL.md` | PDA derivation, rent, account creation        |
| `references/TRANSACTIONS.md`  | Tx limits, CU optimization, versioned txs     |
| `references/SECURITY.md`      | Vulnerabilities, audit checklist, protections |
| `references/CLIENT_SDKS.md`   | @solana/kit vs web3.js, migration guide       |
| `references/TESTING.md`       | Vitest + anchor-bankrun patterns              |
| `references/FUZZ_TESTING.md`  | Trident setup, invariants, flows              |
| `references/MPL_CORE.md`      | Metaplex Core NFT integration                 |
| `references/CODEGEN.md`       | TypeScript codegen from IDL, type mappings    |

### Example Files

Working code examples demonstrating key patterns:

| File                               | Content                                |
| ---------------------------------- | -------------------------------------- |
| `examples/withdraw_instruction.rs` | Complete Anchor instruction example    |
| `examples/test_pattern.ts`         | Vitest + anchor-bankrun test structure |

### External Documentation

Fetch latest docs before implementation—the ecosystem moves fast:

- **Anchor**: https://www.anchor-lang.com/docs
- **Solana**: https://docs.solana.com
- **Metaplex Core**: https://developers.metaplex.com/core
- **Trident**: https://ackee.xyz/trident/docs/dev/

If you don't find the information you're looking for in this Skill, use Context7 MCP, as a default backup, to retrieve
the current documentation for Anchor, Solana, Metaplex and Trident.
