import { assert, beforeEach, describe, expect, it } from "vitest";
import { assertEqBn, assertLteBn } from "../../../common/assertions";
import { LockupTestContext } from "../../context";
import { LinearAmounts, Time, TranchedAmounts, TranchedTimes } from "../../utils/defaults";
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

  describe("given a valid LL stream", () => {
    describe("when the stream has been depleted", () => {
      it("should return DEPLETED", async () => {
        await ctx.timeTravelTo(Time.END);
        await ctx.withdrawMax();
        assert.isTrue((await ctx.statusOf()) === Status.Depleted);
      });
    });

    describe("when the stream has not been depleted", () => {
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
            await ctx.timeTravelTo(Time.START.subn(1));
            assert.isTrue((await ctx.statusOf()) === Status.Pending);
          });
        });

        describe("given start time not in the future", () => {
          describe("given streamed amount equals deposited amount", () => {
            it("should return SETTLED", async () => {
              await ctx.timeTravelTo(Time.END);
              assertEqBn(await ctx.streamedAmountOf(), LinearAmounts.DEPOSIT);
              assert.isTrue((await ctx.statusOf()) === Status.Settled);
            });
          });

          describe("given streamed amount not equal deposited amount", () => {
            it("should return STREAMING", async () => {
              await ctx.timeTravelTo(Time.MID_26_PERCENT);
              assertLteBn(await ctx.streamedAmountOf(), LinearAmounts.DEPOSIT);
              assert.isTrue((await ctx.statusOf()) === Status.Streaming);
            });
          });
        });
      });
    });
  });

  /*//////////////////////////////////////////////////////////////////////////
                              TRANCHED STREAMS
  //////////////////////////////////////////////////////////////////////////*/

  describe("given a valid LT stream", () => {
    describe("when the stream has been depleted", () => {
      it("should return DEPLETED", async () => {
        await ctx.timeTravelTo(TranchedTimes.END);
        await ctx.withdrawMax({ salt: ctx.salts.defaultLt });
        assert.isTrue((await ctx.statusOf(ctx.salts.defaultLt)) === Status.Depleted);
      });
    });

    describe("when the stream has not been depleted", () => {
      describe("given a canceled stream", () => {
        it("should return CANCELED", async () => {
          await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
          await ctx.cancel({ salt: ctx.salts.defaultLt });
          assert.isTrue((await ctx.statusOf(ctx.salts.defaultLt)) === Status.Canceled);
        });
      });

      describe("given a not canceled stream", () => {
        describe("given start time in the future", () => {
          it("should return PENDING", async () => {
            await ctx.timeTravelTo(Time.START.subn(1));
            assert.isTrue((await ctx.statusOf(ctx.salts.defaultLt)) === Status.Pending);
          });
        });

        describe("given start time not in the future", () => {
          describe("given streamed amount equals deposited amount", () => {
            it("should return SETTLED", async () => {
              await ctx.timeTravelTo(TranchedTimes.END);
              assertEqBn(await ctx.streamedAmountOf(ctx.salts.defaultLt), TranchedAmounts.DEPOSIT);
              assert.isTrue((await ctx.statusOf(ctx.salts.defaultLt)) === Status.Settled);
            });
          });

          describe("given streamed amount not equal deposited amount", () => {
            it("should return STREAMING", async () => {
              await ctx.timeTravelTo(TranchedTimes.MID_TRANCHE_1_2);
              assertLteBn(await ctx.streamedAmountOf(ctx.salts.defaultLt), TranchedAmounts.DEPOSIT);
              assert.isTrue((await ctx.statusOf(ctx.salts.defaultLt)) === Status.Streaming);
            });
          });
        });
      });
    });
  });
});
