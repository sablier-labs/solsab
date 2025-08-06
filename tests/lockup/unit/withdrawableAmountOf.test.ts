import { beforeEach, describe, expect, it } from "vitest";
import { ZERO } from "../../../lib/constants";
import { toBn } from "../../../lib/helpers";
import { assertEqualBn } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { Amount, Time } from "../utils/defaults";

let ctx: LockupTestContext;

describe("withdrawableAmountOf", () => {
  beforeEach(async () => {
    ctx = new LockupTestContext();
    await ctx.setUpLockup();
  });

  describe("given a null stream", () => {
    it("should fail", async () => {
      await expect(ctx.withdrawableAmountOf(ctx.salts.nonExisting)).rejects.toThrow(
        "Cannot read properties of null (reading 'data')",
      );
    });
  });

  describe("given a valid stream", () => {
    describe("given a canceled stream", () => {
      describe("given CANCELED status", () => {
        it("should return the correct withdrawable amount", async () => {
          await ctx.timeTravelTo(Time.MID_26_PERCENT);
          await ctx.cancel();
          const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
          const expectedWithdrawableAmount = Amount.STREAMED_26_PERCENT;
          assertEqualBn(actualWithdrawableAmount, expectedWithdrawableAmount);
        });
      });

      describe("given DEPLETED status", () => {
        it("should return zero", async () => {
          await ctx.timeTravelTo(Time.MID_26_PERCENT);
          await ctx.cancel();
          await ctx.withdrawMax();
          const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
          const expectedWithdrawableAmount = ZERO;
          assertEqualBn(actualWithdrawableAmount, expectedWithdrawableAmount);
        });
      });
    });

    describe("given a not canceled stream", () => {
      describe("given PENDING status", () => {
        it("should return zero", async () => {
          await ctx.timeTravelTo(Time.START.sub(toBn(1)));
          const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
          const expectedWithdrawableAmount = ZERO;
          assertEqualBn(actualWithdrawableAmount, expectedWithdrawableAmount);
        });
      });

      describe("given SETTLED status", () => {
        it("should return the correct withdrawable amount", async () => {
          await ctx.timeTravelTo(Time.END);
          const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
          const expectedWithdrawableAmount = Amount.DEPOSIT;
          assertEqualBn(actualWithdrawableAmount, expectedWithdrawableAmount);
        });
      });

      describe("given DEPLETED status", () => {
        it("should return zero", async () => {
          await ctx.timeTravelTo(Time.END);
          await ctx.withdrawMax();
          const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
          const expectedWithdrawableAmount = ZERO;
          assertEqualBn(actualWithdrawableAmount, expectedWithdrawableAmount);
        });
      });

      describe("given STREAMING status", () => {
        describe("given cliff time in future", () => {
          it("should return zero", async () => {
            await ctx.timeTravelTo(Time.CLIFF.sub(toBn(1)));
            const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
            const expectedWithdrawableAmount = ZERO;
            assertEqualBn(actualWithdrawableAmount, expectedWithdrawableAmount);
          });
        });

        describe("given cliff time not in the future", () => {
          describe("given no previous withdrawals", () => {
            it("should return the correct withdrawable amount", async () => {
              await ctx.timeTravelTo(Time.MID_26_PERCENT);
              const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
              const expectedWithdrawableAmount = Amount.STREAMED_26_PERCENT;
              assertEqualBn(actualWithdrawableAmount, expectedWithdrawableAmount);
            });
          });

          describe("given previous withdrawal", () => {
            it("should return the correct withdrawable amount", async () => {
              await ctx.timeTravelTo(Time.MID_26_PERCENT);
              await ctx.withdrawMax();
              const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
              const expectedWithdrawableAmount = ZERO;
              assertEqualBn(actualWithdrawableAmount, expectedWithdrawableAmount);
            });
          });
        });
      });
    });
  });
});
