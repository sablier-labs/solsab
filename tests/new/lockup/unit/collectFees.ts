import {
  collectFees,
  eve,
  getSenderLamports,
  getTreasuryLamports,
  setUp,
  sleepFor,
  timeTravelTo,
  withdrawMax,
} from "../base";
import { assert, assertErrorHexCode, assertFail } from "../utils/assertions";
import { getErrorCode } from "../utils/errors";
import * as defaults from "../utils/defaults";

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
        await withdrawMultipleTimes();

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
          await withdrawMultipleTimes();

          const treasuryLamportsBefore = await getTreasuryLamports();
          const feeRecipientLamportsBefore = await getFeeRecipientLamports();
          // Collect fees
          await collectFees();

          const treasuryLamportsAfter = await getTreasuryLamports();
          const feeRecipientLamportsAfter = await getFeeRecipientLamports();

          const expectedFeesCollected =
            2 * defaults.WITHDRAWAL_FEE_AMOUNT - 1_000_000; // 2 withdrawals worth of fees minus the safety buffer

          assert(
            treasuryLamportsAfter ===
              treasuryLamportsBefore - BigInt(expectedFeesCollected)
          );
          assert(
            feeRecipientLamportsAfter ===
              feeRecipientLamportsBefore + BigInt(expectedFeesCollected)
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
async function withdrawMultipleTimes() {
  await timeTravelTo(defaults.PASS_26_PERCENT);
  await withdrawMax();
  await timeTravelTo(defaults.END_TIME);
  await sleepFor(7);
  await withdrawMax();
}
