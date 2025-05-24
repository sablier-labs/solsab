import {
  collectFees,
  eve,
  getSenderLamports,
  setUp,
  sleepFor,
  timeTravelTo,
  withdrawMax,
} from "../base";
import { assert, assertErrorHexCode } from "../utils/assertions";
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
      } catch (error) {
        assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
      }
    });
  });

  context("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    context("when signer not fee collector", () => {
      it("should revert", async () => {
        await withdrawMultipleTimes();

        try {
          await collectFees(eve.keys);
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("ConstraintAddress"));
        }
      });
    });

    context("when signer fee collector", () => {
      context("given no fees collected", () => {
        it("should revert", async () => {
          try {
            await collectFees();
          } catch (error) {
            assertErrorHexCode(error, getErrorCode("CantCollectZeroFees"));
          }
        });
      });

      context("given fees collected", () => {
        it("should collect the fees", async () => {
          await withdrawMultipleTimes();

          const balanceBefore = await getSenderLamports();
          // Collect fees
          await collectFees();

          const actualFeesCollected =
            (await getSenderLamports()) - balanceBefore;
          const expectedFeesCollected =
            2 * defaults.WITHDRAWAL_FEE_AMOUNT - 1_000_000; // minus the buffer
          assert(Number(actualFeesCollected) === expectedFeesCollected);
        });
      });
    });
  });
});

/// Helper function to withdraw multiple times so that there are fees collected
async function withdrawMultipleTimes() {
  await timeTravelTo(defaults.PASS_26_PERCENT);
  await withdrawMax();
  await timeTravelTo(defaults.END_TIME);
  await sleepFor(5);
  await withdrawMax();
}
