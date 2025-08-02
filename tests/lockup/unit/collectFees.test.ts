import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { REDUNDANCY_BUFFER } from "../../../lib/constants";
import { sleepFor } from "../../../lib/helpers";
import { assertEqualSOLBalance } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { expectToThrow } from "../utils/assertions";
import { Amount, Time } from "../utils/defaults";

let ctx: LockupTestContext;

describe("collectFees", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.collectFees(), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("when signer is not the authorized fee collector", () => {
      it("should fail", async () => {
        await withdrawMultipleTimes();
        await expectToThrow(ctx.collectFees(ctx.eve.keys), CONSTRAINT_ADDRESS);
      });
    });

    describe("when signer is the authorized fee collector", () => {
      describe("given no fees accumulated", () => {
        it("should fail", async () => {
          await expectToThrow(ctx.collectFees(), "CantCollectZeroFees");
        });
      });

      describe("given accumulated fees", () => {
        it("should collect the fees", async () => {
          await withdrawMultipleTimes();

          const beforeLamports = {
            feeRecipient: await getFeeRecipientLamports(),
            treasury: await ctx.getTreasuryLamports(),
          };

          // Collect fees
          await ctx.collectFees();

          const afterLamports = {
            feeRecipient: await getFeeRecipientLamports(),
            treasury: await ctx.getTreasuryLamports(),
          };

          // 2 withdrawals worth of fees minus the minimum lamports balance (a buffer on top of the redundancy buffer).
          const expectedFeesCollected = Amount.WITHDRAW_FEE.muln(2).sub(REDUNDANCY_BUFFER);

          assertEqualSOLBalance(afterLamports.treasury, beforeLamports.treasury.sub(expectedFeesCollected));
          assertEqualSOLBalance(afterLamports.feeRecipient, beforeLamports.feeRecipient.add(expectedFeesCollected));
        });
      });
    });
  });
});

async function getFeeRecipientLamports() {
  return await ctx.getSenderLamports();
}

/// Helper function to withdraw multiple times so that there are fees collected
async function withdrawMultipleTimes() {
  await ctx.timeTravelTo(Time.MID_26_PERCENT);
  await ctx.withdrawMax();
  await ctx.timeTravelTo(Time.END);
  await sleepFor(7);
  await ctx.withdrawMax();
}
