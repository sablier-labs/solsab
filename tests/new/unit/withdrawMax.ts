import { BN } from "@coral-xyz/anchor";
import {
  defaultStreamData,
  fetchStreamData,
  ids,
  setUp,
  timeTravelTo,
  withdrawMax,
} from "../base";
import { assertEqStreamDatas, assertErrorHexCode } from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";

describe("withdrawMax", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp(false);
    });

    it("should revert", async () => {
      try {
        await withdrawMax({ streamId: new BN(1) });
      } catch (error) {
        assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
      }
    });
  });

  context("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    context("given a null stream", () => {
      it("should revert", async () => {
        try {
          await withdrawMax({ streamId: ids.nullStream });
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });

    context("given a valid stream", () => {
      context("given end time not in future", () => {
        it("should make the max withdrawal", async () => {
          await timeTravelTo(defaults.END_TIME);
          await withdrawMax();
          const actualStreamData = await fetchStreamData();
          const expectedStreamData = defaultStreamData({
            isCancelable: false,
            isDepleted: true,
          });
          expectedStreamData.amounts.withdrawn = defaults.DEPOSIT_AMOUNT;
          assertEqStreamDatas(actualStreamData, expectedStreamData);
        });
      });

      context("given end time in future", () => {
        it("should make the max withdrawal", async () => {
          await timeTravelTo(defaults.PASS_26_PERCENT);
          await withdrawMax();
          const actualStreamData = await fetchStreamData();
          const expectedStreamData = defaultStreamData();
          expectedStreamData.amounts.withdrawn =
            defaults.STREAMED_AMOUNT_26_PERCENT;
          assertEqStreamDatas(actualStreamData, expectedStreamData);
        });
      });
    });
  });
});
