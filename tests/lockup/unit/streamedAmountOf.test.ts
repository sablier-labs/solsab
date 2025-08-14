import { beforeEach, describe, expect, it } from "vitest";
import { ZERO } from "../../../lib/constants";
import { toBn } from "../../../lib/helpers";
import { assertEqBn } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { getStreamedAmount } from "../utils/calculations";
import { AMOUNTS, Amount, TIMESTAMPS, Time, UNLOCK_AMOUNTS } from "../utils/defaults";

let ctx: LockupTestContext;

describe("streamedAmountOf", () => {
  beforeEach(async () => {
    ctx = new LockupTestContext();
    await ctx.setUpLockup();
  });

  describe("given a null stream", () => {
    it("should fail", async () => {
      await expect(ctx.streamedAmountOf(ctx.salts.nonExisting)).rejects.toThrow(
        "Cannot read properties of null (reading 'data')",
      );
    });
  });

  describe("given a valid stream", () => {
    describe("given a canceled stream", () => {
      describe("given CANCELED status", () => {
        it("should return the correct streamed amount", async () => {
          await ctx.timeTravelTo(Time.MID_26_PERCENT);
          await ctx.cancel();
          const actualStreamedAmount = await ctx.streamedAmountOf();
          const expectedStreamedAmount = Amount.STREAMED_26_PERCENT;
          assertEqBn(actualStreamedAmount, expectedStreamedAmount);
        });
      });

      describe("given DEPLETED status", () => {
        it("should return the correct streamed amount", async () => {
          await ctx.timeTravelTo(Time.MID_26_PERCENT);
          await ctx.cancel();
          await ctx.withdrawMax();

          let actualStreamedAmount = await ctx.streamedAmountOf();
          const expectedStreamedAmount = Amount.STREAMED_26_PERCENT;
          assertEqBn(actualStreamedAmount, expectedStreamedAmount);

          await ctx.timeTravelTo(Time.MID_26_PERCENT.add(toBn(10)));

          // It should remain the same over time
          actualStreamedAmount = await ctx.streamedAmountOf();
          assertEqBn(actualStreamedAmount, expectedStreamedAmount);
        });
      });
    });

    describe("given a not canceled stream", () => {
      describe("given PENDING status", () => {
        it("should return zero", async () => {
          await ctx.timeTravelTo(Time.START.sub(toBn(1)));
          const actualStreamedAmount = await ctx.streamedAmountOf();
          const expectedStreamedAmount = ZERO;
          assertEqBn(actualStreamedAmount, expectedStreamedAmount);
        });
      });

      describe("given SETTLED status", () => {
        it("should return the deposited amount", async () => {
          await ctx.timeTravelTo(Time.END);

          const actualStreamedAmount = await ctx.streamedAmountOf();
          const expectedStreamedAmount = Amount.DEPOSIT;
          assertEqBn(actualStreamedAmount, expectedStreamedAmount);
        });
      });

      describe("given DEPLETED status", () => {
        it("should return the deposited amount", async () => {
          await ctx.timeTravelTo(Time.END);
          await ctx.withdrawMax();

          const actualStreamedAmount = await ctx.streamedAmountOf();
          const expectedStreamedAmount = Amount.DEPOSIT;
          assertEqBn(actualStreamedAmount, expectedStreamedAmount);
        });
      });

      describe("given STREAMING status", () => {
        describe("given cliff time zero", () => {
          it("should return the correct streamed amount", async () => {
            const salt = await ctx.createWithTimestampsLl({
              timestamps: TIMESTAMPS({ cliff: ZERO }),
              unlockAmounts: UNLOCK_AMOUNTS({ cliff: ZERO }),
            });
            await ctx.timeTravelTo(Time.MID_26_PERCENT);

            const actualStreamedAmount = await ctx.streamedAmountOf(salt);
            const expectedStreamedAmount = Amount.STREAMED_26_PERCENT;
            assertEqBn(actualStreamedAmount, expectedStreamedAmount);
          });
        });

        describe("given cliff time not zero", () => {
          describe("given cliff time in the future", () => {
            it("should return the start amount", async () => {
              const startUnlockAmount = toBn(1);
              const salt = await ctx.createWithTimestampsLl({
                unlockAmounts: UNLOCK_AMOUNTS({ start: startUnlockAmount }),
              });
              await ctx.timeTravelTo(Time.CLIFF.sub(toBn(1)));

              const actualStreamedAmount = await ctx.streamedAmountOf(salt);
              const expectedStreamedAmount = startUnlockAmount;
              assertEqBn(actualStreamedAmount, expectedStreamedAmount);
            });
          });

          describe("given cliff time in the present", () => {
            it("should return the correct streamed amount", async () => {
              await ctx.timeTravelTo(Time.CLIFF);
              const actualStreamedAmount = await ctx.streamedAmountOf();
              const expectedStreamedAmount = Amount.CLIFF;
              assertEqBn(actualStreamedAmount, expectedStreamedAmount);
            });
          });

          describe("given cliff time in the past", () => {
            describe("given start unlock amount not zero", () => {
              it("should return the correct streamed amount", async () => {
                const startUnlockAmount = toBn(1);
                const salt = await ctx.createWithTimestampsLl({
                  unlockAmounts: UNLOCK_AMOUNTS({ start: startUnlockAmount }),
                });
                await ctx.timeTravelTo(Time.MID_26_PERCENT);

                const amounts = AMOUNTS({ startUnlock: startUnlockAmount });

                const actualStreamedAmount = await ctx.streamedAmountOf(salt);
                const expectedStreamedAmount = getStreamedAmount(amounts, Time.MID_26_PERCENT, TIMESTAMPS());
                assertEqBn(actualStreamedAmount, expectedStreamedAmount);
              });
            });

            describe("given start unlock amount zero", () => {
              describe("given cliff unlock amount zero", () => {
                it("should return the correct streamed amount", async () => {
                  const salt = await ctx.createWithTimestampsLl({
                    unlockAmounts: UNLOCK_AMOUNTS({ cliff: ZERO }),
                  });

                  await ctx.timeTravelTo(Time.MID_26_PERCENT);

                  const amounts = AMOUNTS({ cliffUnlock: ZERO });

                  const actualStreamedAmount = await ctx.streamedAmountOf(salt);
                  const expectedStreamedAmount = getStreamedAmount(amounts, Time.MID_26_PERCENT, TIMESTAMPS());
                  assertEqBn(actualStreamedAmount, expectedStreamedAmount);
                });
              });

              describe("given cliff unlock amount not zero", () => {
                it("should return the correct streamed amount", async () => {
                  await ctx.timeTravelTo(Time.MID_26_PERCENT);
                  const actualStreamedAmount = await ctx.streamedAmountOf();
                  const expectedStreamedAmount = Amount.STREAMED_26_PERCENT;
                  assertEqBn(actualStreamedAmount, expectedStreamedAmount);
                });
              });
            });
          });
        });
      });
    });
  });
});
