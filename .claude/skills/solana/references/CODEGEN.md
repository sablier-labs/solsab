# TypeScript Code Generation

Automatically generate TypeScript bindings from Anchor IDL files.

## Build Process

The `just build` command performs two steps:

1. **Anchor Build**: Compiles Rust programs → generates IDL JSON in `target/idl/`
2. **Codegen**: Generates TypeScript types from IDL → outputs to `target/types/`

```bash
# Build all programs (includes codegen)
just build
# or: just b

# Build specific program
just build sablier_lockup
just build sablier_merkle_instant

# Run codegen separately (after manual IDL changes)
just codegen all
just codegen sablier_lockup
```

## Generated Files

| Source                      | Generated                           |
| --------------------------- | ----------------------------------- |
| `target/idl/{program}.json` | `target/types/{program}_errors.ts`  |
| (IDL `errors` field)        | `target/types/{program}_structs.ts` |

### Error Bindings (`*_errors.ts`)

Generated from IDL `errors` array:

```typescript
// target/types/sablier_lockup_errors.ts
export const ProgramErrorCode = {
  StreamDepleted: 6000,
  StreamNotCancelable: 6001,
  // ... all errors from #[error_code] enum
} as const;

export type ProgramErrorName = keyof typeof ProgramErrorCode;
```

### Struct Bindings (`*_structs.ts`)

Generated from IDL `types` array (structs and enums):

```typescript
// target/types/sablier_lockup_structs.ts
import type { BN } from "@coral-xyz/anchor";
import { type PublicKey } from "@solana/web3.js";

export type StreamData = {
  bump: number;
  sender: PublicKey;
  depositedTokenMint: PublicKey;
  amounts: Amounts;
  timestamps: Timestamps;
  isCancelable: boolean;
  isDepleted: boolean;
  wasCanceled: boolean;
};

export type Amounts = {
  deposited: BN;
  withdrawn: BN;
  refunded: BN;
  startUnlock: BN;
  cliffUnlock: BN;
};
```

## Type Mappings

Rust/Solana types are converted to TypeScript:

| Rust Type   | TypeScript Type | Notes                           |
| ----------- | --------------- | ------------------------------- |
| `u8`, `u32` | `number`        | Small integers                  |
| `u64`       | `BN`            | Large integers (BigNumber)      |
| `u128`      | `BN`            | Very large integers             |
| `i64`       | `BN`            | Signed large integers           |
| `bool`      | `boolean`       |                                 |
| `Pubkey`    | `PublicKey`     | From `@solana/web3.js`          |
| `String`    | `string`        |                                 |
| `[T; N]`    | `T[]`           | Fixed arrays → dynamic arrays   |
| Custom      | Same name       | Structs/enums reference by name |

## Script Architecture

```
scripts/ts/
├── codegen-errors.ts       # Generates *_errors.ts from IDL errors
├── codegen-structs.ts      # Generates *_structs.ts from IDL types
└── common/
    └── codegen-utils.ts    # Shared utilities (IDL reading, file writing)
```

### Adding New Type Mappings

If codegen fails with "Unknown type", add the mapping to `RUST_TYPES` in `codegen-structs.ts`:

```typescript
const RUST_TYPES = {
  bool: "boolean",
  u8: "number",
  u64: "BN",
  // Add new type here
  newType: "TypeScriptEquivalent",
} as const;
```

## Usage in Tests

Import generated types for type-safe test assertions:

```typescript
import type { StreamData, Amounts } from "../target/types/sablier_lockup_structs";
import { ProgramErrorCode } from "../target/types/sablier_lockup_errors";

// Type-safe account data
const streamData: StreamData = await program.account.streamData.fetch(pda);
assertEqBn(streamData.amounts.deposited, expectedDeposit);

// Type-safe error checking
await expectToThrow(ctx.withdraw(), ProgramErrorCode.StreamDepleted);
```

## Regenerating Types

Types must be regenerated when:

- Adding/removing/modifying `#[account]` structs in Rust
- Adding/removing/modifying `#[error_code]` errors in Rust
- Changing field types or names

```bash
# Full rebuild (recommended)
just build

# Or regenerate types only (if IDL is already updated)
just codegen all
```

## Troubleshooting

### "IDL incorrectly formatted" Error

The IDL file is missing expected fields. Ensure:

- Program compiled successfully with `anchor build`
- IDL file exists in `target/idl/`

### "Unknown type" Error

A Rust type isn't mapped. Add it to `RUST_TYPES` in `codegen-structs.ts`.

### Types Out of Sync

If TypeScript types don't match on-chain data:

1. Run `just build` to regenerate IDL and types
2. Check that IDL reflects latest Rust struct definitions
3. Ensure no manual edits to generated files (they get overwritten)
