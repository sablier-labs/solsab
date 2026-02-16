import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ERR_ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as ERR_CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeEach, describe, it } from "vitest";
import { REDUNDANCY_BUFFER } from "../../../lib/constants";
import { assertEqBn } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { expectToThrow } from "../utils/assertions";

let ctx: LockupTestContext;

describe("collectFees", () => {
  describe("when the program is not initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.collectFees(), ERR_ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("when signer is not the authorized fee collector", () => {
      it("should fail", async () => {
        await ctx.simulateFeeGeneration();
        await expectToThrow(ctx.collectFees(ctx.eve.keys), ERR_CONSTRAINT_ADDRESS);
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
          const fees = await ctx.simulateFeeGeneration();

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

          const expectedFeesCollected = fees.sub(REDUNDANCY_BUFFER);

          // Assert that the treasury balance has been updated correctly.
          assertEqBn(beforeLamports.treasury.sub(afterLamports.treasury), expectedFeesCollected);

          // Assert that the recipient balance has been updated correctly.
          assertEqBn(
            afterLamports.feeRecipient.sub(beforeLamports.feeRecipient),
            expectedFeesCollected,
          );
        });
      });
    });
  });
});

async function getFeeRecipientLamports() {
  return await ctx.getSenderLamports();
}
