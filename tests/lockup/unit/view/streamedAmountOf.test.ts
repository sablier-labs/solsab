import { beforeEach, describe, expect, it } from "vitest";
import { ZERO } from "../../../../lib/constants";
import { toBn } from "../../../../lib/helpers";
import { assertEqBn } from "../../../common/assertions";
import { LockupTestContext } from "../../context";
import { getLinearStreamedAmount } from "../../utils/calculations";
import {
  LINEAR_AMOUNTS,
  LINEAR_TIMESTAMPS,
  LINEAR_UNLOCK_AMOUNTS,
  LinearAmounts,
  Time,
  TranchedAmounts,
  TranchedTimes,
  UNLOCK_AMOUNTS,
} from "../../utils/defaults";

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
    describe("given LL model", () => {
      describe("given a canceled stream", () => {
        describe("when the stream has not been depleted", () => {
          it("should return the correct streamed amount", async () => {
            await ctx.timeTravelTo(Time.MID_26_PERCENT);
            await ctx.cancel();
            const actualStreamedAmount = await ctx.streamedAmountOf();
            const expectedStreamedAmount = LinearAmounts.STREAMED_26_PERCENT;
            assertEqBn(actualStreamedAmount, expectedStreamedAmount);
          });
        });

        describe("when the stream has been depleted", () => {
          it("should return the correct streamed amount", async () => {
            await ctx.timeTravelTo(Time.MID_26_PERCENT);
            await ctx.cancel();
            await ctx.withdrawMax();

            let actualStreamedAmount = await ctx.streamedAmountOf();
            const expectedStreamedAmount = LinearAmounts.STREAMED_26_PERCENT;
            assertEqBn(actualStreamedAmount, expectedStreamedAmount);

            await ctx.timeTravelTo(Time.MID_26_PERCENT.addn(10));

            // It should remain the same over time
            actualStreamedAmount = await ctx.streamedAmountOf();
            assertEqBn(actualStreamedAmount, expectedStreamedAmount);
          });
        });
      });

      describe("given a not canceled stream", () => {
        describe("given PENDING status", () => {
          it("should return zero", async () => {
            await ctx.timeTravelTo(Time.START.subn(1));
            const actualStreamedAmount = await ctx.streamedAmountOf();
            const expectedStreamedAmount = ZERO;
            assertEqBn(actualStreamedAmount, expectedStreamedAmount);
          });
        });

        describe("given SETTLED status", () => {
          it("should return the deposited amount", async () => {
            await ctx.timeTravelTo(Time.END);

            const actualStreamedAmount = await ctx.streamedAmountOf();
            const expectedStreamedAmount = LinearAmounts.DEPOSIT;
            assertEqBn(actualStreamedAmount, expectedStreamedAmount);
          });
        });

        describe("given DEPLETED status", () => {
          it("should return the deposited amount", async () => {
            await ctx.timeTravelTo(Time.END);
            await ctx.withdrawMax();

            const actualStreamedAmount = await ctx.streamedAmountOf();
            const expectedStreamedAmount = LinearAmounts.DEPOSIT;
            assertEqBn(actualStreamedAmount, expectedStreamedAmount);
          });
        });

        describe("given STREAMING status", () => {
          describe("given cliff time zero", () => {
            it("should return the correct streamed amount", async () => {
              const salt = await ctx.createWithTimestampsLl({
                timestamps: LINEAR_TIMESTAMPS({ cliff: ZERO }),
                unlockAmounts: UNLOCK_AMOUNTS({ cliff: ZERO }),
              });
              await ctx.timeTravelTo(Time.MID_26_PERCENT);

              const actualStreamedAmount = await ctx.streamedAmountOf(salt);
              const expectedStreamedAmount = LinearAmounts.STREAMED_26_PERCENT;
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
                await ctx.timeTravelTo(Time.CLIFF.subn(1));

                const actualStreamedAmount = await ctx.streamedAmountOf(salt);
                const expectedStreamedAmount = startUnlockAmount;
                assertEqBn(actualStreamedAmount, expectedStreamedAmount);
              });
            });

            describe("given cliff time in the present", () => {
              it("should return the correct streamed amount", async () => {
                await ctx.timeTravelTo(Time.CLIFF);
                const actualStreamedAmount = await ctx.streamedAmountOf();
                const expectedStreamedAmount = LinearAmounts.CLIFF;
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

                  const amounts = LINEAR_AMOUNTS();
                  const unlockAmounts = LINEAR_UNLOCK_AMOUNTS({ start: startUnlockAmount });

                  const actualStreamedAmount = await ctx.streamedAmountOf(salt);
                  const expectedStreamedAmount = getLinearStreamedAmount(
                    amounts,
                    Time.MID_26_PERCENT,
                    LINEAR_TIMESTAMPS(),
                    unlockAmounts,
                  );
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

                    const amounts = LINEAR_AMOUNTS();
                    const unlockAmounts = LINEAR_UNLOCK_AMOUNTS({ cliff: ZERO });

                    const actualStreamedAmount = await ctx.streamedAmountOf(salt);
                    const expectedStreamedAmount = getLinearStreamedAmount(
                      amounts,
                      Time.MID_26_PERCENT,
                      LINEAR_TIMESTAMPS(),
                      unlockAmounts,
                    );
                    assertEqBn(actualStreamedAmount, expectedStreamedAmount);
                  });
                });

                describe("given cliff unlock amount not zero", () => {
                  it("should return the correct streamed amount", async () => {
                    await ctx.timeTravelTo(Time.MID_26_PERCENT);
                    const actualStreamedAmount = await ctx.streamedAmountOf();
                    const expectedStreamedAmount = LinearAmounts.STREAMED_26_PERCENT;
                    assertEqBn(actualStreamedAmount, expectedStreamedAmount);
                  });
                });
              });
            });
          });
        });
      });
    });

    describe("given LT model", () => {
      describe("given a canceled stream", () => {
        describe("when the stream has not been depleted", () => {
          it("should return the correct streamed amount", async () => {
            await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
            await ctx.cancel({ salt: ctx.salts.defaultLt });

            const actualStreamedAmount = await ctx.streamedAmountOf(ctx.salts.defaultLt);
            // After cancel, streamed = deposited - refunded = tranche_1
            assertEqBn(actualStreamedAmount, TranchedAmounts.TRANCHE_1);
          });
        });

        describe("when the stream has been depleted", () => {
          it("should return the correct streamed amount", async () => {
            await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
            await ctx.cancel({ salt: ctx.salts.defaultLt });
            await ctx.withdrawMax({ salt: ctx.salts.defaultLt });

            let actualStreamedAmount = await ctx.streamedAmountOf(ctx.salts.defaultLt);
            assertEqBn(actualStreamedAmount, TranchedAmounts.TRANCHE_1);

            await ctx.timeTravelTo(TranchedTimes.TRANCHE_2);

            // It should remain the same over time
            actualStreamedAmount = await ctx.streamedAmountOf(ctx.salts.defaultLt);
            assertEqBn(actualStreamedAmount, TranchedAmounts.TRANCHE_1);
          });
        });
      });

      describe("given a not canceled stream", () => {
        describe("given PENDING status", () => {
          it("should return 0", async () => {
            await ctx.timeTravelTo(Time.START.subn(1));
            const actualStreamedAmount = await ctx.streamedAmountOf(ctx.salts.defaultLt);
            assertEqBn(actualStreamedAmount, ZERO);
          });
        });

        describe("given STREAMING status", () => {
          describe("given before first tranche", () => {
            it("should return 0", async () => {
              await ctx.timeTravelTo(TranchedTimes.TRANCHE_1.subn(1));
              const actualStreamedAmount = await ctx.streamedAmountOf(ctx.salts.defaultLt);
              assertEqBn(actualStreamedAmount, ZERO);
            });
          });

          describe("given between tranche 1 and 2", () => {
            it("should return the correct amount", async () => {
              await ctx.timeTravelTo(TranchedTimes.MID_TRANCHE_1_2);
              const actualStreamedAmount = await ctx.streamedAmountOf(ctx.salts.defaultLt);
              assertEqBn(actualStreamedAmount, TranchedAmounts.TRANCHE_1);
            });
          });

          describe("given now > end time", () => {
            it("should return the deposited amount", async () => {
              await ctx.timeTravelTo(TranchedTimes.END.addn(1));
              const actualStreamedAmount = await ctx.streamedAmountOf(ctx.salts.defaultLt);
              assertEqBn(actualStreamedAmount, TranchedAmounts.DEPOSIT);
            });
          });
        });

        describe("given SETTLED status", () => {
          it("should return the deposited amount", async () => {
            await ctx.timeTravelTo(TranchedTimes.END);
            const actualStreamedAmount = await ctx.streamedAmountOf(ctx.salts.defaultLt);
            assertEqBn(actualStreamedAmount, TranchedAmounts.DEPOSIT);
          });
        });

        describe("given DEPLETED status", () => {
          it("should return the deposited amount", async () => {
            await ctx.timeTravelTo(TranchedTimes.END);
            await ctx.withdrawMax({ salt: ctx.salts.defaultLt });

            const actualStreamedAmount = await ctx.streamedAmountOf(ctx.salts.defaultLt);
            assertEqBn(actualStreamedAmount, TranchedAmounts.DEPOSIT);
          });
        });
      });
    });
  });
});
