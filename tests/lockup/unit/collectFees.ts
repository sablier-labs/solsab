import {
  collectFees,
  getSenderLamports,
  getTreasuryLamports,
  setUp,
  withdrawMax,
} from "../base";
import { eve, sleepFor, timeTravelTo } from "../../common-base";
import { assert, assertErrorHexCode, assertFail } from "../utils/assertions";
import { getErrorCode } from "../utils/errors";
import * as defaults from "../utils/defaults";
import { getFeeInLamports } from "../../oracles";

describe("collectFees", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp(false);
    });

    it("should revert", async () => {
      try {
        await collectFees();
        assertFail();
      } catch (error) {
        assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
      }
    });
  });

  context("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    context("when signer is not the authorized fee collector", () => {
      it("should revert", async () => {
        await withdrawTwice();

        try {
          await collectFees(eve.keys);
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("ConstraintAddress"));
        }
      });
    });

    context("when signer is the authorized fee collector", () => {
      context("given no fees accumulated", () => {
        it("should revert", async () => {
          try {
            await collectFees();
            assertFail();
          } catch (error) {
            assertErrorHexCode(error, getErrorCode("CantCollectZeroFees"));
          }
        });
      });

      context("given accumulated fees", () => {
        it("should collect the fees", async () => {
          await withdrawTwice();

          const treasuryLamportsBefore = await getTreasuryLamports();
          const feeRecipientLamportsBefore = await getFeeRecipientLamports();
          // Collect fees
          await collectFees();

          const treasuryLamportsAfter = await getTreasuryLamports();
          const feeRecipientLamportsAfter = await getFeeRecipientLamports();

          const expectedFeesCollected =
            2 * (await getFeeInLamports(defaults.WITHDRAWAL_FEE_USD)) -
            1_000_000; // 2 withdrawals worth of fees minus the safety buffer

          const treasuryBalanceDifference = Math.abs(
            Number(treasuryLamportsBefore - treasuryLamportsAfter)
          );

          // Assert that the Treasury has been debited with an amount that is within 5% of the expected amount
          assert(
            Math.abs(treasuryBalanceDifference - expectedFeesCollected) <=
              Math.floor(expectedFeesCollected * 0.05),
            "The Treasury hasn't been debited the expected amount of fees"
          );

          // Assert that the fee recipient has been credited with an amount that is within 5% of the expected amount
          const feeRecipientBalanceDifference = Math.abs(
            Number(feeRecipientLamportsAfter - feeRecipientLamportsBefore)
          );
          assert(
            Math.abs(feeRecipientBalanceDifference - expectedFeesCollected) <=
              Math.floor(expectedFeesCollected * 0.05),
            "The fee recipient hasn't been credited the expected amount of fees"
          );
        });
      });
    });
  });
});

async function getFeeRecipientLamports() {
  return await getSenderLamports();
}

/// Helper function to withdraw multiple times so that there are fees collected
async function withdrawTwice() {
  await timeTravelTo(defaults.PASS_26_PERCENT);
  await withdrawMax();
  await timeTravelTo(defaults.END_TIME);
  await sleepFor(7);
  await withdrawMax();
}
