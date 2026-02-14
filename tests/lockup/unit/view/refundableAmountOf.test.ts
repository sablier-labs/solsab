import { beforeEach, describe, expect, it } from "vitest";
import { ZERO } from "../../../../lib/constants";
import { assertEqBn } from "../../../common/assertions";
import { LockupTestContext } from "../../context";
import { LinearAmounts, Time, TranchedAmounts, TranchedTimes } from "../../utils/defaults";

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
    describe("given LL model", () => {
      describe("given a non cancelable stream", () => {
        it("should return zero", async () => {
          const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.nonCancelableLl);
          const expectedRefundableAmount = ZERO;
          assertEqBn(actualRefundableAmount, expectedRefundableAmount);
        });
      });

      describe("given a cancelable stream", () => {
        describe("given a canceled stream", () => {
          describe("when the stream has not been depleted", () => {
            it("should return zero", async () => {
              await ctx.timeTravelTo(Time.MID_26_PERCENT);
              await ctx.cancel();
              const actualRefundableAmount = await ctx.refundableAmountOf();
              const expectedRefundableAmount = ZERO;
              assertEqBn(actualRefundableAmount, expectedRefundableAmount);
            });
          });

          describe("when the stream has been depleted", () => {
            it("should return zero", async () => {
              await ctx.timeTravelTo(Time.MID_26_PERCENT);
              await ctx.cancel();
              await ctx.withdrawMax();
              const actualRefundableAmount = await ctx.refundableAmountOf();
              const expectedRefundableAmount = ZERO;
              assertEqBn(actualRefundableAmount, expectedRefundableAmount);
            });
          });
        });

        describe("given a not canceled stream", () => {
          describe("given PENDING status", () => {
            it("should return the deposited amount", async () => {
              await ctx.timeTravelTo(Time.START.subn(1));
              const actualRefundableAmount = await ctx.refundableAmountOf();
              const expectedRefundableAmount = LinearAmounts.DEPOSIT;
              assertEqBn(actualRefundableAmount, expectedRefundableAmount);
            });
          });

          describe("given STREAMING status", () => {
            it("should return the correct refundable amount", async () => {
              await ctx.timeTravelTo(Time.MID_26_PERCENT);
              const actualRefundableAmount = await ctx.refundableAmountOf();
              const expectedRefundableAmount = LinearAmounts.REFUND;
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

    describe("given LT model", () => {
      describe("given a non cancelable stream", () => {
        it("should return zero", async () => {
          const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.nonCancelableLt);
          assertEqBn(actualRefundableAmount, ZERO);
        });
      });

      describe("given a cancelable stream", () => {
        describe("given a canceled stream", () => {
          describe("when the stream has not been depleted", () => {
            it("should return zero", async () => {
              await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
              await ctx.cancel({ salt: ctx.salts.defaultLt });
              const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.defaultLt);
              assertEqBn(actualRefundableAmount, ZERO);
            });
          });

          describe("when the stream has been depleted", () => {
            it("should return zero", async () => {
              await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
              await ctx.cancel({ salt: ctx.salts.defaultLt });
              await ctx.withdrawMax({ salt: ctx.salts.defaultLt });
              const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.defaultLt);
              assertEqBn(actualRefundableAmount, ZERO);
            });
          });
        });

        describe("given a not canceled stream", () => {
          describe("given PENDING status", () => {
            it("should return the deposited amount", async () => {
              await ctx.timeTravelTo(Time.START.subn(1));
              const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.defaultLt);
              assertEqBn(actualRefundableAmount, TranchedAmounts.DEPOSIT);
            });
          });

          describe("given STREAMING status", () => {
            describe("when before first tranche", () => {
              it("should return the deposited amount", async () => {
                await ctx.timeTravelTo(TranchedTimes.TRANCHE_1.subn(1));
                const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.defaultLt);
                assertEqBn(actualRefundableAmount, TranchedAmounts.DEPOSIT);
              });
            });

            describe("when between tranche 1 and 2", () => {
              it("should return the correct amount", async () => {
                await ctx.timeTravelTo(TranchedTimes.MID_TRANCHE_1_2);
                const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.defaultLt);
                const expectedRefundableAmount = TranchedAmounts.DEPOSIT.sub(
                  TranchedAmounts.TRANCHE_1,
                );
                assertEqBn(actualRefundableAmount, expectedRefundableAmount);
              });
            });
          });

          describe("given SETTLED status", () => {
            it("should return zero", async () => {
              await ctx.timeTravelTo(TranchedTimes.END);
              const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.defaultLt);
              assertEqBn(actualRefundableAmount, ZERO);
            });
          });

          describe("given DEPLETED status", () => {
            it("should return zero", async () => {
              await ctx.timeTravelTo(TranchedTimes.END);
              await ctx.withdrawMax({ salt: ctx.salts.defaultLt });
              const actualRefundableAmount = await ctx.refundableAmountOf(ctx.salts.defaultLt);
              assertEqBn(actualRefundableAmount, ZERO);
            });
          });
        });
      });
    });
  });
});
