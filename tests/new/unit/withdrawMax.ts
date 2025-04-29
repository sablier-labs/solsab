import {
  defaultStreamData,
  fetchStreamData,
  setUp,
  timeTravelTo,
  withdrawMax,
} from "../base";
import { assertStreamData } from "../utils/assertions";
import * as defaults from "../utils/defaults";

describe("withdrawMax", () => {
  beforeEach(async () => {
    await setUp();
  });

  context("given end time not in future", () => {
    it("should make the max withdrawal", async () => {
      await timeTravelTo(defaults.END_TIME);
      await withdrawMax();
      const actualStreamData = await fetchStreamData();
      const expectedStreamData = await defaultStreamData({
        isCancelable: false,
        isDepleted: true,
      });
      expectedStreamData.amounts.withdrawn = defaults.DEPOSIT_AMOUNT;
      assertStreamData(actualStreamData, expectedStreamData);
    });
  });

  context("given end time in future", () => {
    it("should make the max withdrawal", async () => {
      await timeTravelTo(defaults.PASS_26_PERCENT);
      await withdrawMax();
      const actualStreamData = await fetchStreamData();
      const expectedStreamData = await defaultStreamData();
      expectedStreamData.amounts.withdrawn =
        defaults.STREAMED_AMOUNT_26_PERCENT;
      assertStreamData(actualStreamData, expectedStreamData);
    });
  });
});
