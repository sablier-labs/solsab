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
2. **Priority Fee**: Optional, based on compute unit price
3. **Rent**: For account creation (one-time, rent-exempt)

### Priority Fees

```typescript
// Setting priority fee (in micro-lamports per CU)
const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
  units: 200_000,
});

const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
  microLamports: 1_000, // 0.001 lamports per CU
});

// Total priority fee = CU limit × price in micro-lamports ÷ 1,000,000
// Example: 200,000 × 1,000 ÷ 1,000,000 = 200 lamports
```

### Rent Costs

```typescript
// Rent-exempt minimum for account
const rentExempt = await connection.getMinimumBalanceForRentExemption(dataSize);
```

## Compute Units (CUs)

### Defaults & Limits

- **Default allocation**: 200,000 CUs per instruction
- **Maximum per transaction**: 1,400,000 CUs
- **Maximum per account**: No limit (bounded by transaction limit)

### Setting Compute Budget

```typescript
// TypeScript
const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
  units: 400_000, // Increase for complex operations
});

// Add as FIRST instruction
transaction.add(modifyComputeUnits);
```

```rust
// Rust (logging consumption)
msg!("Compute units consumed: {}", sol_log_compute_units());
```

### CU Optimization Strategies

1. **Minimize account serialization** - Use `Box<Account<>>` for large accounts
2. **Batch operations** - Fewer instructions = less overhead
3. **Avoid unnecessary validation** - Trust Anchor's built-in checks
4. **Use view functions** - Zero-cost reads for computation-heavy queries
5. **Profile with `sol_log_compute_units()`** - Identify hotspots

## Versioned Transactions

### Legacy vs Versioned

```typescript
// Legacy (default)
const transaction = new Transaction();

// Versioned (for Address Lookup Tables)
const messageV0 = new TransactionMessage({
  payerKey: payer.publicKey,
  recentBlockhash,
  instructions,
}).compileToV0Message(addressLookupTableAccounts);

const transactionV0 = new VersionedTransaction(messageV0);
```

### Address Lookup Tables (ALTs)

Compress account addresses to save transaction space:

```typescript
// Create ALT
const [createIx, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot,
});

// Extend ALT with addresses
const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: [address1, address2, ...],
});

// Use in versioned transaction
const lookupTableAccount = await connection.getAddressLookupTable(lookupTableAddress);
const messageV0 = new TransactionMessage({...}).compileToV0Message([lookupTableAccount.value]);
```

## Blockhash & Expiry

### Blockhash Validity

- **Valid for**: ~60-90 seconds (~150 slots)
- **Recommended refresh**: Before each transaction

```typescript
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

// Wait for confirmation with expiry check
await connection.confirmTransaction({
  blockhash,
  lastValidBlockHeight,
  signature,
});
```

### Durable Nonces

For transactions that need longer validity:

```typescript
// Create nonce account
const nonceAccount = Keypair.generate();
const createNonceIx = SystemProgram.createNonceAccount({
  fromPubkey: payer.publicKey,
  noncePubkey: nonceAccount.publicKey,
  authorizedPubkey: payer.publicKey,
  lamports: rentExempt,
});

// Use nonce in transaction
const advanceNonceIx = SystemProgram.nonceAdvance({
  noncePubkey: nonceAccount.publicKey,
  authorizedPubkey: payer.publicKey,
});

transaction.add(advanceNonceIx); // Must be first instruction
transaction.recentBlockhash = nonceAccountInfo.nonce;
```

## Transaction Simulation

Always simulate before sending:

```typescript
const simulation = await connection.simulateTransaction(transaction);

if (simulation.value.err) {
  console.error("Simulation failed:", simulation.value.err);
  console.log("Logs:", simulation.value.logs);
}
```

## Batching Strategies

### Multiple Instructions

```typescript
// Single transaction, multiple instructions
const tx = new Transaction().add(instruction1).add(instruction2).add(instruction3);
```

### Parallel Transactions

```typescript
// Send multiple transactions in parallel
const signatures = await Promise.all([
  sendAndConfirmTransaction(connection, tx1, [signer]),
  sendAndConfirmTransaction(connection, tx2, [signer]),
]);
```
