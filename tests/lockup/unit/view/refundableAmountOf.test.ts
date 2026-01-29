import { beforeEach, describe, expect, it } from "vitest";
import { ZERO } from "../../../../lib/constants";
import { toBn } from "../../../../lib/helpers";
import { assertEqBn } from "../../../common/assertions";
import { LockupTestContext } from "../../context";
import { Amount, Time } from "../../utils/defaults";

let ctx: LockupTestContext;

describe("refundableAmountOf", () => {
  beforeEach(async () => {
    ctx = new LockupTestContext();
    await ctx.setUpLockup();
  });

  describe("given a null stream", () => {
    it("should fail", async () => {
      await expect(ctx.refundableAmountOf(ctx.salts.nonExisting)).rejects.toThrow(
        "Cannot read properties of null (reading 'data')",
      );
    });
  });

  describe("given a valid stream", () => {
    describe("given non cancelable stream", () => {
      it("should return zero", async () => {
        const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.nonCancelableLl);
        const expectedRefundableAmount = ZERO;
        assertEqBn(actualRefundableAmount, expectedRefundableAmount);
      });
    });

    describe("given cancelable stream", () => {
      describe("given a canceled stream and CANCELED status", () => {
        it("should return zero", async () => {
          await ctx.timeTravelTo(Time.MID_26_PERCENT);
          await ctx.cancel();
          const actualRefundableAmount = await ctx.refundableAmountOf();
          const expectedRefundableAmount = ZERO;
          assertEqBn(actualRefundableAmount, expectedRefundableAmount);
        });
      });

      describe("given a canceled stream and DEPLETED status", () => {
        it("should return zero", async () => {
          await ctx.timeTravelTo(Time.MID_26_PERCENT);
          await ctx.cancel();
          await ctx.withdrawMax();
          const actualRefundableAmount = await ctx.refundableAmountOf();
          const expectedRefundableAmount = ZERO;
          assertEqBn(actualRefundableAmount, expectedRefundableAmount);
        });
      });

      describe("given a not canceled stream", () => {
        describe("given PENDING status", () => {
          it("should return the deposited amount", async () => {
            await ctx.timeTravelTo(Time.START.sub(toBn(1)));
            const actualRefundableAmount = await ctx.refundableAmountOf();
            const expectedRefundableAmount = Amount.DEPOSIT;
            assertEqBn(actualRefundableAmount, expectedRefundableAmount);
          });
        });

        describe("given STREAMING status", () => {
          it("should return the correct refundable amount", async () => {
            await ctx.timeTravelTo(Time.MID_26_PERCENT);
            const actualRefundableAmount = await ctx.refundableAmountOf();
            const expectedRefundableAmount = Amount.REFUND;
            assertEqBn(actualRefundableAmount, expectedRefundableAmount);
          });
        });

        describe("given SETTLED status", () => {
          it("should return zero", async () => {
            await ctx.timeTravelTo(Time.END);
            const actualRefundableAmount = await ctx.refundableAmountOf();
            const expectedRefundableAmount = ZERO;
            assertEqBn(actualRefundableAmount, expectedRefundableAmount);
          });
        });

        describe("given DEPLETED status", () => {
          it("should return zero", async () => {
            await ctx.timeTravelTo(Time.END);
            await ctx.withdrawMax();
            const actualRefundableAmount = await ctx.refundableAmountOf();
            const expectedRefundableAmount = ZERO;
            assertEqBn(actualRefundableAmount, expectedRefundableAmount);
          });
        });
      });
    });
  });
});
