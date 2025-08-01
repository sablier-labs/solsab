import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { feeInLamports } from "../../../lib/chainlink-mock";
import { REDUNDANCY_BUFFER } from "../../../lib/constants";
import { sleepFor } from "../../../lib/helpers";
import { assertLteBn } from "../../common/assertions";
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

    it("should revert", async () => {
      await expectToThrow(ctx.collectFees(), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("when signer is not the authorized fee collector", () => {
      it("should revert", async () => {
        await withdrawTwice();
        await expectToThrow(ctx.collectFees(ctx.eve.keys), CONSTRAINT_ADDRESS);
      });
    });

    describe("when signer is the authorized fee collector", () => {
      describe("given no fees accumulated", () => {
        it("should revert", async () => {
          await expectToThrow(ctx.collectFees(), "CantCollectZeroFees");
        });
      });

      describe("given accumulated fees", () => {
        it("should collect the fees", async () => {
          await withdrawTwice();

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

          const withdrawalFee = feeInLamports(Amount.WITHDRAWAL_FEE_USD);
          // 2 withdrawals worth of fees minus the redundancy buffer.
          const expectedFeesCollected = withdrawalFee.muln(2).sub(REDUNDANCY_BUFFER);

          // Assert that the Treasury has been debited with an amount that is within 5% of the expected amount
          const treasuryBalanceDifference = beforeLamports.treasury.sub(afterLamports.treasury).abs();
          assertLteBn(
            treasuryBalanceDifference.sub(expectedFeesCollected).abs(),
            expectedFeesCollected.mul(new BN(5)).div(new BN(100)),
          );

          // Assert that the fee recipient has been credited with an amount that is within 5% of the expected amount
          const feeRecipientBalanceDifference = afterLamports.feeRecipient.sub(beforeLamports.feeRecipient).abs();
          assertLteBn(
            feeRecipientBalanceDifference.sub(expectedFeesCollected).abs(),
            expectedFeesCollected.mul(new BN(5)).div(new BN(100)),
          );
        });
      });
    });
  });
});

async function getFeeRecipientLamports() {
  return await ctx.getSenderLamports();
}

/// Helper function to withdraw multiple times so that there are fees collected
async function withdrawTwice() {
  await ctx.timeTravelTo(Time.MID_26_PERCENT);
  await ctx.withdrawMax();
  await ctx.timeTravelTo(Time.END);
  await sleepFor(7);
  await ctx.withdrawMax();
}
