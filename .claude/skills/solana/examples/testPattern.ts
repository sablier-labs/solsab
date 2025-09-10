// Example: Vitest + anchor-bankrun test patterns
// Reference: tests/lockup/unit/withdraw.test.ts
//
// This file demonstrates testing patterns used in the codebase.
// It is not meant to be compiled directly.

// ============================================================================
// TEST STRUCTURE: Nested describe blocks for state isolation
// ============================================================================

// Import patterns from actual tests:
// import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
// import { beforeAll, beforeEach, describe, it } from "vitest";
// import { assertEqBn, expectToThrow } from "../../common/assertions";
// import { LockupTestContext } from "../context";
// import { Amount, Time } from "../utils/defaults";

let ctx: LockupTestContext;

describe("withdraw", () => {
  // Test uninitialized program state
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      await ctx.timeTravelTo(Time.MID_26_PERCENT);
    });

    it("should fail", async () => {
      await expectToThrow(ctx.withdraw({ salt: BN_1 }), ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED);
    });
  });

  // Test initialized program state
  describe("when the program is initialized", () => {
    // Fresh context for each test
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
      await ctx.timeTravelTo(Time.MID_26_PERCENT);
    });

    // Negative test: null stream
    describe("given a null stream", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.withdraw({ salt: ctx.salts.nonExisting }),
          ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED,
        );
      });
    });

    describe("given a valid stream", () => {
      // Test depleted state
      describe("when stream status is DEPLETED", () => {
        it("should fail", async () => {
          await ctx.timeTravelTo(Time.END);
          await ctx.withdrawMax();
          await expectToThrow(ctx.withdraw(), "StreamDepleted");
        });
      });

      // Positive test with assertions
      describe("when withdraw amount is valid", () => {
        it("should transfer tokens to recipient", async () => {
          const balanceBefore = await ctx.getATABalance(ctx.recipient.usdc);

          await ctx.withdraw({ withdrawAmount: Amount.WITHDRAW });

          const balanceAfter = await ctx.getATABalance(ctx.recipient.usdc);
          assertEqBn(balanceAfter.sub(balanceBefore), Amount.WITHDRAW);
        });

        it("should emit WithdrawFromLockupStream event", async () => {
          // Event emission verification via program logs
          await ctx.withdraw({ withdrawAmount: Amount.WITHDRAW });
          // Verify event data in tx logs
        });
      });
    });
  });
});

// ============================================================================
// TEST CONTEXT PATTERN: Reusable setup with program-specific helpers
// See tests/lockup/context.ts for full implementation
// ============================================================================

class LockupTestContext extends TestContext {
  public program!: anchor.Program<SablierLockup>;

  async setUpLockup({ initProgram = true } = {}) {
    await super.setUp("sablier_lockup", programId, [
      // Load additional programs (e.g., Token Metadata)
      { name: "token_metadata", programId: MPL_TOKEN_METADATA_ID },
    ]);

    this.program = new anchor.Program<SablierLockup>(IDL, this.provider);

    if (initProgram) {
      await this.initialize();
    }
  }

  // Time travel for testing time-dependent logic
  async timeTravelTo(timestamp: BN) {
    await this.banksClient.warpToTimestamp(timestamp.toNumber());
  }

  // Program-specific helper methods
  async withdraw(params: Partial<WithdrawParams> = {}) {
    return this.program.methods
      .withdraw(params.withdrawAmount ?? Amount.WITHDRAW)
      .accounts({
        signer: params.signer ?? this.recipient.publicKey,
        streamData: this.getStreamDataPDA(params.salt ?? this.salts.default),
        // ... other accounts
      })
      .signers([params.signer ?? this.recipient.keys])
      .rpc();
  }
}

// ============================================================================
// ASSERTION UTILITIES
// See tests/common/assertions.ts for full implementation
// ============================================================================

function assertEqBn(left: BN, right: BN, message?: string) {
  const msg = message ?? `BN mismatch: ${left.toString()} !== ${right.toString()}`;
  assert.isTrue(left.eq(right), msg);
}

async function expectToThrow(promise: Promise<unknown>, errorCode: string | number) {
  if (typeof errorCode === "number") {
    return expect(promise).rejects.toThrow(`0x${errorCode.toString(16)}`);
  }
  return expect(promise).rejects.toThrow(errorCode);
}

// ============================================================================
// TEST DEFAULTS: Factory functions for mutable test data
// See tests/lockup/utils/defaults.ts for full implementation
// ============================================================================

namespace Amount {
  export const DEPOSIT = usdc(10_000);
  export const WITHDRAW = usdc("2600.000001"); // ~26% of deposit at MID_26_PERCENT
}

namespace Time {
  export const GENESIS = new BN(1754142441);
  export const START = GENESIS.add(new BN(1000));
  export const END = START.add(new BN(86400 * 365));
  export const MID_26_PERCENT = START.add(END.sub(START).muln(26).divn(100));
}
