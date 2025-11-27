# Solana Testing with Vitest + anchor-bankrun

## Stack Overview

Use **Vitest** as the test runner and **anchor-bankrun** for Solana runtime emulation. This combination provides:

- Fast test execution (no validator startup)
- Deterministic results
- Time travel capabilities
- Full program deployment support

### Dependencies

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@coral-xyz/anchor": "^0.31.0",
    "anchor-bankrun": "^0.5.0",
    "@solana/spl-token": "^0.4.0"
  }
}
```

### Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 10_000,
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    testTimeout: 10_000,
  },
});
```

## Test Context Pattern

### Base Context

Create a reusable base context:

```typescript
// tests/common/context.ts
export class TestContext {
  public banksClient!: BanksClient;
  public bankrunProvider!: BankrunProvider;
  public payer!: Keypair;

  // Common test users
  public alice!: User;
  public bob!: User;

  // Common tokens
  public usdc!: PublicKey;
  public dai!: PublicKey;

  async setUp(programName: string, programId: PublicKey, additionalPrograms: ProgramEntry[] = []) {
    const programs = [{ name: programName, programId }, ...additionalPrograms];

    this.context = await startAnchor("", programs, []);
    this.banksClient = this.context.banksClient;
    this.bankrunProvider = new BankrunProvider(this.context);

    // Create test tokens
    await this.createTokens();

    // Create test users with funded accounts
    this.alice = await this.createUser();
    this.bob = await this.createUser();
  }

  async createUser(): Promise<User> {
    const keypair = Keypair.generate();
    // Fund with SOL
    await this.airdrop(keypair.publicKey, 100 * LAMPORTS_PER_SOL);
    return { keypair, publicKey: keypair.publicKey };
  }

  async createTokens() {
    this.usdc = await createMint(this.banksClient, this.payer, 6);
    this.dai = await createMint(this.banksClient, this.payer, 18);
  }
}
```

### Program-Specific Context

Extend for each program:

```typescript
// tests/lockup/context.ts
export class LockupTestContext extends TestContext {
  public program!: anchor.Program<SablierLockup>;
  public treasuryAddress!: PublicKey;

  async setUpLockup({ initProgram = true } = {}) {
    await super.setUp("sablier_lockup", new PublicKey(IDL.address), [
      { name: "token_metadata_program", programId: MPL_TOKEN_METADATA_ID },
    ]);

    this.program = new anchor.Program<SablierLockup>(IDL, this.bankrunProvider);
    this.treasuryAddress = this.getPDA([Seed.TREASURY]);

    if (initProgram) {
      await this.initialize();
    }
  }

  async initialize() {
    await this.program.methods
      .initialize()
      .accounts({
        admin: this.payer.publicKey,
        treasury: this.treasuryAddress,
      })
      .signers([this.payer])
      .rpc();
  }

  async createStream(params: CreateStreamParams) {
    // Program-specific helper
  }
}
```

## Assertion Utilities

```typescript
// tests/common/assertions.ts
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export function assertEqBn(left: BN, right: BN, message?: string) {
  const defaultMessage = `BN mismatch: ${left.toString()} !== ${right.toString()}`;
  assert.isTrue(left.eq(right), message ?? defaultMessage);
}

export function assertEqPublicKey(left: PublicKey, right: PublicKey, message?: string) {
  const defaultMessage = `PublicKey mismatch: ${left.toBase58()} !== ${right.toBase58()}`;
  assert.isTrue(left.equals(right), message ?? defaultMessage);
}

export function expectToThrow(promise: Promise<unknown>, errorCode: string | number) {
  if (typeof errorCode === "number") {
    return expect(promise).rejects.toThrow(`0x${errorCode.toString(16)}`);
  }
  return expect(promise).rejects.toThrow(errorCode);
}

// For Anchor error codes
export function expectAnchorError(promise: Promise<unknown>, errorName: keyof typeof ErrorCode) {
  const code = ErrorCode[errorName];
  return expect(promise).rejects.toThrow(`0x${code.toString(16)}`);
}
```

## Test Defaults

Use factory functions for mutable defaults:

```typescript
// tests/lockup/utils/defaults.ts
import { BN } from "@coral-xyz/anchor";

export const ZERO = new BN(0);

// Token converters
export function usdc(amount: number | string): BN {
  if (typeof amount === "number") {
    return new BN(amount).mul(new BN(10 ** 6));
  }
  return new BN(parseUnits(amount, 6).toString());
}

export function dai(amount: number | string): BN {
  if (typeof amount === "number") {
    return new BN(amount).mul(new BN(10 ** 18));
  }
  return new BN(parseUnits(amount, 18).toString());
}

// Namespaced defaults
export namespace Amount {
  export const DEPOSIT = usdc(10_000);
  export const CLIFF = usdc("2500.000001");
  export const START = ZERO;
}

export namespace Time {
  export const GENESIS = new BN(1754142441); // Fixed for mocks
  export const START = GENESIS.add(new BN(1000));
  export const CLIFF = START.add(new BN(86400 * 30)); // 30 days
  export const END = START.add(new BN(86400 * 365)); // 1 year
}

// Factory for mutable structs
export function AMOUNTS(overrides: Partial<Amounts> = {}): Amounts {
  return {
    deposited: Amount.DEPOSIT,
    withdrawn: ZERO,
    refunded: ZERO,
    ...overrides,
  };
}
```

## Test Structure

```typescript
// tests/lockup/unit/cancel.test.ts
describe("cancel", () => {
  let ctx: LockupTestContext;

  describe("when program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.cancel({ streamId: new PublicKey(0) }), "AccountNotInitialized");
    });
  });

  describe("when program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("when stream is not cancelable", () => {
      it("should fail with StreamNotCancelable", async () => {
        const streamId = await ctx.createStream({ isCancelable: false });
        await expectAnchorError(ctx.cancel({ streamId }), "StreamNotCancelable");
      });
    });

    describe("when stream is cancelable", () => {
      it("should transfer remaining tokens to sender", async () => {
        const streamId = await ctx.createStream({ isCancelable: true });

        const senderBalanceBefore = await ctx.getTokenBalance(ctx.sender);
        await ctx.cancel({ streamId });
        const senderBalanceAfter = await ctx.getTokenBalance(ctx.sender);

        assertEqBn(senderBalanceAfter.sub(senderBalanceBefore), Amount.DEPOSIT);
      });
    });
  });
});
```

## Time Travel

```typescript
// tests/common/anchor-bankrun.ts
export async function timeTravelTo(
  banksClient: BanksClient,
  targetTimestamp: BN
) {
  const clock = await banksClient.getClock();
  const currentSlot = clock.slot;
  const currentTimestamp = new BN(clock.unixTimestamp);

  const secondsToAdvance = targetTimestamp.sub(currentTimestamp);
  const slotsToAdvance = secondsToAdvance.divn(400); // ~400ms per slot

  await banksClient.warpToSlot(currentSlot + slotsToAdvance.toNumber());
}

// In test context
async timeTravelTo(timestamp: BN) {
  await timeTravelTo(this.banksClient, timestamp);
}

// Usage in test
it("should allow withdrawal after cliff", async () => {
  await ctx.timeTravelTo(Time.CLIFF);
  await ctx.withdraw({ streamId });
  // Assert withdrawal succeeded
});
```

## Bankrun Utilities

```typescript
// tests/common/anchor-bankrun.ts
export async function getLatestBlockhash(banksClient: BanksClient): Promise<string> {
  const [blockhash] = await banksClient.getLatestBlockhash();
  return blockhash;
}

export async function buildSignAndProcessTx(
  banksClient: BanksClient,
  ixs: TransactionInstruction | TransactionInstruction[],
  signers: Keypair | Keypair[],
  cuLimit = 1_400_000,
): Promise<BanksTransactionMeta> {
  const tx = new Transaction();
  tx.recentBlockhash = await getLatestBlockhash(banksClient);

  if (cuLimit) {
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }));
  }

  const instructions = Array.isArray(ixs) ? ixs : [ixs];
  instructions.forEach((ix) => tx.add(ix));

  const signerArray = Array.isArray(signers) ? signers : [signers];
  tx.sign(...signerArray);

  return await banksClient.processTransaction(tx);
}

export async function createMint(banksClient: BanksClient, payer: Keypair, decimals: number): Promise<PublicKey> {
  const mint = Keypair.generate();
  // ... mint creation logic
  return mint.publicKey;
}

export async function mintTo(
  banksClient: BanksClient,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  amount: BN,
): Promise<void> {
  // ... mint tokens logic
}
```

## Oracle Mocking (Chainlink)

```typescript
// tests/common/chainlink-mock.ts
export class ChainlinkMock {
  private readonly feedAddress: PublicKey;
  private readonly price: BN;
  private readonly timestamp: BN;

  constructor(
    price: BN = new BN(150_00000000), // $150.00 with 8 decimals
    timestamp: BN = Time.GENESIS,
  ) {
    this.feedAddress = new PublicKey("...");
    this.price = price;
    this.timestamp = timestamp;
  }

  async accountData(): Promise<AddedAccount> {
    // Return serialized Chainlink feed account data
    return {
      address: this.feedAddress,
      info: {
        lamports: LAMPORTS_PER_SOL,
        data: this.serializeFeedData(),
        owner: CHAINLINK_PROGRAM_ID,
        executable: false,
      },
    };
  }
}

// In test setup
const chainlinkMock = new ChainlinkMock();
const addedAccounts = [await chainlinkMock.accountData()];
this.context = await startAnchor("", programs, addedAccounts);
```

## Running Tests

```bash
# Run all unit tests (builds first)
just test
# or: just t

# Run tests without rebuilding
just test-lite
# or: just tl

# Run with Vitest UI
just test-ui
# or: just tui

# Run specific program tests
just test-lockup
# or: just tlk

just test-merkle-instant
# or: just tmi

# Run specific test file
just test tests/lockup/unit/cancel.test.ts

# Run with pattern matching
just test --grep "cancel"

# Debug Solana logs
RUST_LOG=debug just test
```

### Test Aliases Quick Reference

| Command                    | Alias | Purpose                  |
| -------------------------- | ----- | ------------------------ |
| `just test`                | `t`   | Run all tests (w/ build) |
| `just test-lite`           | `tl`  | Run tests (skip build)   |
| `just test-ui`             | `tui` | Interactive Vitest UI    |
| `just test-lockup`         | `tlk` | Lockup program only      |
| `just test-merkle-instant` | `tmi` | Merkle Instant only      |
