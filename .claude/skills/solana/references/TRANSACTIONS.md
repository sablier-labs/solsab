# Solana Transactions

## Transaction Structure

```
Transaction
├── signatures: Vec<Signature>     # Ed25519 signatures
└── message: Message
    ├── header: MessageHeader      # Counts of signers, read-only accounts
    ├── account_keys: Vec<Pubkey>  # All accounts used
    ├── recent_blockhash: Hash     # For replay protection
    └── instructions: Vec<CompiledInstruction>
        ├── program_id_index: u8   # Index into account_keys
        ├── accounts: Vec<u8>      # Indices into account_keys
        └── data: Vec<u8>          # Instruction data
```

### Size Limits

- **Maximum transaction size**: 1232 bytes
- **Maximum accounts per transaction**: 256 (limited by u8 indexing)
- **Maximum instructions**: No hard limit, but bounded by size

## Fee Model

### Components

1. **Base Fee**: 5,000 lamports per signature (0.000005 SOL)
2. **Priority Fee**: Optional, based on compute unit price (micro-lamports per CU)
3. **Rent**: One-time deposit for account creation (rent-exempt threshold)

### Rent-Exempt Balance

Accounts must maintain a minimum lamport balance to exist on-chain. Calculate it dynamically:

```typescript
const rentExempt = await connection.getMinimumBalanceForRentExemption(accountDataSize);
```

Use `#[derive(InitSpace)]` in Anchor to calculate space requirements automatically.

## Compute Units (CUs)

### Defaults & Limits

- **Default allocation**: 200,000 CUs per instruction
- **Maximum per transaction**: 1,400,000 CUs
- **Maximum per account**: No limit (bounded by transaction limit)

### Setting Compute Budget

```typescript
import { ComputeBudgetProgram } from "@solana/web3.js";

// Request specific compute units
const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
  units: 400_000,
});

// Add as FIRST instruction
transaction.add(computeUnitIx);
```

### Logging CU Consumption

```rust
msg!("Compute units consumed: {}", sol_log_compute_units());
```

### CU Optimization Strategies

1. **Minimize account serialization** - Use `Box<Account<>>` for large accounts
2. **Batch operations** - Fewer instructions = less overhead
3. **Avoid unnecessary validation** - Trust Anchor's built-in checks
4. **Use view functions** - Zero-cost reads for computation-heavy queries
5. **Profile with `sol_log_compute_units()`** - Identify hotspots

## Transaction Batching

### Multiple Instructions in One Transaction

Combine related operations to reduce signature overhead:

```typescript
const transaction = new Transaction().add(instruction1).add(instruction2).add(instruction3);

// All succeed or all fail (atomic)
await sendAndConfirmTransaction(connection, transaction, [payer]);
```

### When to Batch

- Related state changes that should be atomic
- Operations on the same accounts (reduces account loading)
- Sequential operations where failure should roll back all
