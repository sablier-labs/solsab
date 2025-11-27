# Solana Client SDKs

## SDK Comparison

| Feature       | @solana/kit (new)         | @solana/web3.js (legacy) |
| ------------- | ------------------------- | ------------------------ |
| Architecture  | Modular, tree-shakeable   | Monolithic               |
| Bundle Size   | ~20KB (tree-shaken)       | ~100KB+                  |
| TypeScript    | First-class, strict types | Adequate                 |
| Maintenance   | Active development        | Maintenance mode         |
| Documentation | Growing                   | Extensive                |
| Examples      | Limited                   | Abundant                 |

## @solana/kit (Recommended for New Projects)

The modern, modular SDK for Solana.

### Installation

```bash
pnpm add @solana/kit
```

### Key Features

- **Tree-shakeable**: Only include what you use
- **Modular packages**: Import specific functionality
- **Better TypeScript**: Stricter types, better inference
- **Functional API**: Composable operations

### Basic Usage

```typescript
import { createSolanaRpc, createSolanaRpcSubscriptions, address, lamports, signature } from "@solana/kit";

// Create RPC client
const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");

// Get balance
const balance = await rpc.getBalance(address("...")).send();

// Subscribe to account changes
const subscriptions = createSolanaRpcSubscriptions("wss://...");
const accountNotifications = subscriptions.accountNotifications(address("..."), { commitment: "confirmed" });

for await (const notification of accountNotifications) {
  console.log("Account changed:", notification);
}
```

### Transaction Building

```typescript
import {
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  compileTransaction,
  signTransaction,
} from "@solana/kit";

// Build transaction
const message = pipe(
  createTransactionMessage({ version: 0 }),
  (msg) => setTransactionMessageFeePayer(payerAddress, msg),
  (msg) => setTransactionMessageLifetimeUsingBlockhash(blockhash, msg),
  (msg) => appendTransactionMessageInstruction(instruction, msg),
);

const transaction = compileTransaction(message);
const signedTx = await signTransaction([keypair], transaction);
```

## @solana/web3.js (Legacy)

The established SDK with extensive documentation.

### Installation

```bash
pnpm add @solana/web3.js
```

### Basic Usage

```typescript
import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

// Create connection
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Get balance
const balance = await connection.getBalance(new PublicKey("..."));

// Build and send transaction
const transaction = new Transaction().add(instruction);
const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
```

### Common Patterns

```typescript
// Get recent blockhash
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

// Simulate transaction
const simulation = await connection.simulateTransaction(transaction);
if (simulation.value.err) {
  console.error("Simulation failed:", simulation.value.logs);
}

// Confirm with retry
const confirmation = await connection.confirmTransaction({
  signature,
  blockhash,
  lastValidBlockHeight,
});
```

## Anchor Client Integration

When working with Anchor programs, use `@coral-xyz/anchor`:

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MyProgram } from "../target/types/my_program";

// With wallet adapter
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });

const program = new Program<MyProgram>(IDL, provider);

// Call instruction
await program.methods
  .createStream(amount, startTime, endTime)
  .accounts({
    sender: wallet.publicKey,
    streamData: streamPDA,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

// Fetch account
const streamData = await program.account.streamData.fetch(streamPDA);
```

## Migration Guide: web3.js → kit

### Connection

```typescript
// Before (web3.js)
const connection = new Connection(endpoint);

// After (kit)
const rpc = createSolanaRpc(endpoint);
```

### Public Keys

```typescript
// Before (web3.js)
const pubkey = new PublicKey("...");

// After (kit)
const addr = address("...");
```

### Transactions

```typescript
// Before (web3.js)
const tx = new Transaction().add(instruction);
tx.feePayer = payer;
tx.recentBlockhash = blockhash;

// After (kit)
const message = pipe(
  createTransactionMessage({ version: 0 }),
  setTransactionMessageFeePayer(payer),
  setTransactionMessageLifetimeUsingBlockhash(blockhash),
  appendTransactionMessageInstruction(instruction),
);
```

## Best Practices

1. **New projects**: Start with @solana/kit
2. **Existing projects**: Migrate incrementally or stay with web3.js
3. **Use Anchor client**: For Anchor program interactions in tests
4. **Handle errors**: Both SDKs can throw on network issues
