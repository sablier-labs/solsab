import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1 } from "../../../lib/constants";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Amount, Time } from "../utils/defaults";

let ctx: LockupTestContext;

describe("withdrawMax", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.withdrawMax({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("given a null stream", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.withdrawMax({ salt: ctx.salts.nonExisting }),
          ACCOUNT_NOT_INITIALIZED,
        );
      });
    });

    describe("given a valid stream", () => {
      describe("given end time not in the future", () => {
        it("should make the max withdrawal", async () => {
          await ctx.timeTravelTo(Time.END);
          await ctx.withdrawMax();
          const actualStreamData = await ctx.fetchStreamData();
          const expectedStreamData = ctx.defaultStream({
            isCancelable: false,
            isDepleted: true,
          }).data;
          expectedStreamData.amounts.withdrawn = Amount.DEPOSIT;
          assertEqStreamData(actualStreamData, expectedStreamData);
        });
      });

      describe("given end time in the future", () => {
        it("should make the max withdrawal", async () => {
          await ctx.timeTravelTo(Time.MID_26_PERCENT);
          await ctx.withdrawMax();
          const actualStreamData = await ctx.fetchStreamData();
          const expectedStreamData = ctx.defaultStream().data;
          expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;
          assertEqStreamData(actualStreamData, expectedStreamData);
        });
      });
    });
  });
});
