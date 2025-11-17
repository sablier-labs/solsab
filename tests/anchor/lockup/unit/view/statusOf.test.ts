import { assert, beforeEach, describe, expect, it } from "vitest";
import { toBn } from "../../../../../lib/helpers";
import { assertEqBn, assertLteBn } from "../../../common/assertions";
import { LockupTestContext } from "../../context";
import { Amount, Time } from "../../utils/defaults";
import { Status } from "../../utils/types";

let ctx: LockupTestContext;

describe("statusOf", () => {
  beforeEach(async () => {
    ctx = new LockupTestContext();
    await ctx.setUpLockup();
  });

  describe("given a null stream", () => {
    it("should fail", async () => {
      await expect(ctx.statusOf(ctx.salts.nonExisting)).rejects.toThrow(
        "Cannot read properties of null (reading 'data')",
      );
    });
  });

  describe("given a valid stream", () => {
    describe("given tokens fully withdrawn", () => {
      it("should return DEPLETED", async () => {
        await ctx.timeTravelTo(Time.END);
        await ctx.withdrawMax();
        assert.isTrue((await ctx.statusOf()) === Status.Depleted);
      });
    });

    describe("given tokens not fully withdrawn", () => {
      describe("given a canceled stream", () => {
        it("should return CANCELED", async () => {
          await ctx.timeTravelTo(Time.MID_26_PERCENT);
          await ctx.cancel();
          assert.isTrue((await ctx.statusOf()) === Status.Canceled);
        });
      });

      describe("given a not canceled stream", () => {
        describe("given start time in the future", () => {
          it("should return PENDING", async () => {
            await ctx.timeTravelTo(Time.START.sub(toBn(1)));
            assert.isTrue((await ctx.statusOf()) === Status.Pending);
          });
        });

        describe("given start time not in future", () => {
          describe("given streamed amount equals deposited amount", () => {
            it("should return SETTLED", async () => {
              await ctx.timeTravelTo(Time.END);
              assertEqBn(await ctx.streamedAmountOf(), Amount.DEPOSIT);
              assert.isTrue((await ctx.statusOf()) === Status.Settled);
            });
          });

          describe("given streamed amount not equal deposited amount", () => {
            it("should return STREAMING", async () => {
              await ctx.timeTravelTo(Time.MID_26_PERCENT);
              assertLteBn(await ctx.streamedAmountOf(), Amount.DEPOSIT);
              assert.isTrue((await ctx.statusOf()) === Status.Streaming);
            });
          });
        });
      });
    });
  });
});
