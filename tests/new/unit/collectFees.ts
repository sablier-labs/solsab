import {
  banksClient,
  collectFees,
  eve,
  sender,
  setUp,
  timeTravelTo,
  withdrawMax,
} from "../base";
import { assert, assertError } from "../utils/assertions";
import { getErrorCode } from "../utils/errors";
import * as defaults from "../utils/defaults";

describe("collectFees", () => {
  beforeEach(async () => {
    await setUp();
  });

  context("when signer not fee collector", () => {
    it("should revert", async () => {
      await withdrawMultipleTimes();

      try {
        await collectFees(eve.keys);
      } catch (error) {
        assertError(error, "0x7dc");
      }
    });
  });

  context("when signer fee collector", () => {
    context("given no fees collected", () => {
      it("should revert", async () => {
        try {
          await collectFees();
        } catch (error) {
          assertError(error, getErrorCode("CantCollectZeroFees"));
        }
      });
    });

    context("given fees collected", () => {
      it("should collect the fees", async () => {
        await withdrawMultipleTimes();

        const balanceBefore = await banksClient.getBalance(
          sender.keys.publicKey
        );
        // Collect fees
        await collectFees();

        const actualFeesCollected =
          (await banksClient.getBalance(sender.keys.publicKey)) - balanceBefore;
        const expectedFeesCollected =
          2 * defaults.WITHDRAWAL_FEE_AMOUNT - 1_000_000; // minnus the buffer
        assert(Number(actualFeesCollected) === expectedFeesCollected);
      });
    });
  });
});

/// Helper function to withdraw multiple times so that there are fees collected
async function withdrawMultipleTimes() {
  await timeTravelTo(defaults.PASS_26_PERCENT);
  await withdrawMax();
  await timeTravelTo(defaults.END_TIME);
  await withdrawMax();
}
