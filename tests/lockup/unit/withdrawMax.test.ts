import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1 } from "../../../lib/constants";
import { timeTravelTo } from "../../common/base";
import { defaultStream, fetchStreamData, salts, setUp, withdrawMax } from "../base";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Amount, Time } from "../utils/defaults";

describe("withdrawMax", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({ initProgram: false });
    });

    it("should revert", async () => {
      await expectToThrow(withdrawMax({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    describe("given a null stream", () => {
      it("should revert", async () => {
        await expectToThrow(withdrawMax({ salt: salts.nonExisting }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("given a valid stream", () => {
      describe("given end time not in future", () => {
        it("should make the max withdrawal", async () => {
          await timeTravelTo(Time.END);
          await withdrawMax();
          const actualStreamData = await fetchStreamData();
          const expectedStreamData = defaultStream({
            isCancelable: false,
            isDepleted: true,
          }).data;
          expectedStreamData.amounts.withdrawn = Amount.DEPOSIT;
          assertEqStreamData(actualStreamData, expectedStreamData);
        });
      });

      describe("given end time in future", () => {
        it("should make the max withdrawal", async () => {
          await timeTravelTo(Time.MID_26_PERCENT);
          await withdrawMax();
          const actualStreamData = await fetchStreamData();
          const expectedStreamData = defaultStream().data;
          expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;
          assertEqStreamData(actualStreamData, expectedStreamData);
        });
      });
    });
  });
});
