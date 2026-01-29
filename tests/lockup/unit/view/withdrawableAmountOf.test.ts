import { beforeEach, describe, expect, it } from "vitest";
import { ZERO } from "../../../../lib/constants";
import { toBn } from "../../../../lib/helpers";
import { assertEqBn } from "../../../common/assertions";
import { LockupTestContext } from "../../context";
import { Amount, Time, TranchedAmounts, TranchedTimes } from "../../utils/defaults";

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
      it("should return the correct withdrawable amount", async () => {
        await ctx.timeTravelTo(Time.MID_26_PERCENT);
        await ctx.cancel();
        const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
        const expectedWithdrawableAmount = Amount.STREAMED_26_PERCENT;
        assertEqBn(actualWithdrawableAmount, expectedWithdrawableAmount);
      });
    });

    describe("given a not canceled stream", () => {
      describe("given PENDING status", () => {
        it("should return zero", async () => {
          await ctx.timeTravelTo(Time.START.sub(toBn(1)));
          const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
          const expectedWithdrawableAmount = ZERO;
          assertEqBn(actualWithdrawableAmount, expectedWithdrawableAmount);
        });
      });

      describe("given SETTLED status", () => {
        it("should return the correct withdrawable amount", async () => {
          await ctx.timeTravelTo(Time.END);
          const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
          const expectedWithdrawableAmount = Amount.DEPOSIT;
          assertEqBn(actualWithdrawableAmount, expectedWithdrawableAmount);
        });
      });

      describe("given DEPLETED status", () => {
        it("should return zero", async () => {
          await ctx.timeTravelTo(Time.END);
          await ctx.withdrawMax();
          const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
          const expectedWithdrawableAmount = ZERO;
          assertEqBn(actualWithdrawableAmount, expectedWithdrawableAmount);
        });
      });

      describe("given STREAMING status", () => {
        describe("given cliff time in future", () => {
          it("should return zero", async () => {
            await ctx.timeTravelTo(Time.CLIFF.sub(toBn(1)));
            const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
            const expectedWithdrawableAmount = ZERO;
            assertEqBn(actualWithdrawableAmount, expectedWithdrawableAmount);
          });
        });

        describe("given cliff time not in the future", () => {
          describe("given no previous withdrawals", () => {
            it("should return the correct withdrawable amount", async () => {
              await ctx.timeTravelTo(Time.MID_26_PERCENT);
              const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
              const expectedWithdrawableAmount = Amount.STREAMED_26_PERCENT;
              assertEqBn(actualWithdrawableAmount, expectedWithdrawableAmount);
            });
          });

          describe("given previous withdrawal", () => {
            it("should return the correct withdrawable amount", async () => {
              await ctx.timeTravelTo(Time.MID_26_PERCENT);
              await ctx.withdrawMax();
              const actualWithdrawableAmount = await ctx.withdrawableAmountOf();
              const expectedWithdrawableAmount = ZERO;
              assertEqBn(actualWithdrawableAmount, expectedWithdrawableAmount);
            });
          });
        });
      });
    });
  });

  /*//////////////////////////////////////////////////////////////////////////
                              TRANCHED STREAMS
  //////////////////////////////////////////////////////////////////////////*/

  describe("given a tranched stream", () => {
    describe("given before first tranche", () => {
      it("should return 0", async () => {
        await ctx.timeTravelTo(Time.START.addn(100));
        const actualWithdrawableAmount = await ctx.withdrawableAmountOf(ctx.salts.defaultLt);
        assertEqBn(actualWithdrawableAmount, ZERO);
      });
    });

    describe("given after first tranche, no withdrawals", () => {
      it("should return tranche_1.amount", async () => {
        await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
        const actualWithdrawableAmount = await ctx.withdrawableAmountOf(ctx.salts.defaultLt);
        assertEqBn(actualWithdrawableAmount, TranchedAmounts.TRANCHE_1);
      });
    });

    describe("given after first tranche, partial withdrawal", () => {
      it("should return tranche_1.amount - withdrawn", async () => {
        await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);

        // Withdraw half of tranche 1
        const partialWithdraw = TranchedAmounts.TRANCHE_1.divn(2);
        await ctx.withdraw({
          salt: ctx.salts.defaultLt,
          withdrawAmount: partialWithdraw,
        });

        const actualWithdrawableAmount = await ctx.withdrawableAmountOf(ctx.salts.defaultLt);
        const expectedWithdrawableAmount = TranchedAmounts.TRANCHE_1.sub(partialWithdraw);
        assertEqBn(actualWithdrawableAmount, expectedWithdrawableAmount);
      });
    });

    describe("given after all tranches, no withdrawals", () => {
      it("should return deposited", async () => {
        await ctx.timeTravelTo(TranchedTimes.END);
        const actualWithdrawableAmount = await ctx.withdrawableAmountOf(ctx.salts.defaultLt);
        assertEqBn(actualWithdrawableAmount, TranchedAmounts.DEPOSIT);
      });
    });

    describe("given DEPLETED", () => {
      it("should return 0", async () => {
        await ctx.timeTravelTo(TranchedTimes.END);
        await ctx.withdrawMax({ salt: ctx.salts.defaultLt });
        const actualWithdrawableAmount = await ctx.withdrawableAmountOf(ctx.salts.defaultLt);
        assertEqBn(actualWithdrawableAmount, ZERO);
      });
    });
  });
});
