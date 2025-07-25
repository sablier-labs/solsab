import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { MIN_LAMPORTS_BALANCE } from "../../../lib/constants";
import { sleepFor } from "../../../lib/helpers";
import { assertEqualBalanceSOL } from "../../common/assertions";
import { eve, timeTravelTo } from "../../common/base";
import { collectFees, getSenderLamports, getTreasuryLamports, setUp, withdrawMax } from "../base";
import { expectToThrow } from "../utils/assertions";
import { Amount, Time } from "../utils/defaults";

describe("collectFees", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({ initProgram: false });
    });

    it("should revert", async () => {
      await expectToThrow(collectFees(), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    describe("when signer is not the authorized fee collector", () => {
      it("should revert", async () => {
        await withdrawMultipleTimes();
        await expectToThrow(collectFees(eve.keys), CONSTRAINT_ADDRESS);
      });
    });

    describe("when signer is the authorized fee collector", () => {
      describe("given no fees accumulated", () => {
        it("should revert", async () => {
          await expectToThrow(collectFees(), "CantCollectZeroFees");
        });
      });

      describe("given accumulated fees", () => {
        it("should collect the fees", async () => {
          await withdrawMultipleTimes();

          const beforeLamports = {
            feeRecipient: await getFeeRecipientLamports(),
            treasury: await getTreasuryLamports(),
          };

          // Collect fees
          await collectFees();

          const afterLamports = {
            feeRecipient: await getFeeRecipientLamports(),
            treasury: await getTreasuryLamports(),
          };

          // 2 withdrawals worth of fees minus the minimum lamports balance (a buffer on top of the minimum rent).
          const expectedFeesCollected = Amount.WITHDRAW_FEE.muln(2).sub(MIN_LAMPORTS_BALANCE);

          assertEqualBalanceSOL(afterLamports.treasury, beforeLamports.treasury.sub(expectedFeesCollected));
          assertEqualBalanceSOL(afterLamports.feeRecipient, beforeLamports.feeRecipient.add(expectedFeesCollected));
        });
      });
    });
  });
});

async function getFeeRecipientLamports() {
  return await getSenderLamports();
}

/// Helper function to withdraw multiple times so that there are fees collected
async function withdrawMultipleTimes() {
  await timeTravelTo(Time.MID_26_PERCENT);
  await withdrawMax();
  await timeTravelTo(Time.END);
  await sleepFor(7);
  await withdrawMax();
}
