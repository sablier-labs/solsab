import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { MAX_U64, ZERO } from "../../../lib/constants";
import { toBn } from "../../../lib/helpers";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time, TRANCHED_MODEL, TranchedAmounts, TranchedDurations } from "../utils/defaults";

let ctx: LockupTestContext;

describe("createWithDurationsLt", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      await ctx.timeTravelTo(Time.START);
    });

    it("should fail", async () => {
      await expectToThrow(ctx.createWithDurationsLt({ salt: ZERO }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
      await ctx.timeTravelTo(Time.START);
    });

    describe("given amounts.length != durations.length", () => {
      it("should fail when amounts array is longer", async () => {
        await expectToThrow(
          ctx.createWithDurationsLt({
            trancheAmounts: [TranchedAmounts.TRANCHE_1, TranchedAmounts.TRANCHE_2],
            trancheDurations: [TranchedDurations.TRANCHE_1],
          }),
          "TrancheAmountsDurationsMismatch",
        );
      });

      it("should fail when durations array is longer", async () => {
        await expectToThrow(
          ctx.createWithDurationsLt({
            trancheAmounts: [TranchedAmounts.TRANCHE_1],
            trancheDurations: [TranchedDurations.TRANCHE_1, TranchedDurations.TRANCHE_2],
          }),
          "TrancheAmountsDurationsMismatch",
        );
      });
    });

    describe("given duration causes timestamp overflow", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.createWithDurationsLt({
            trancheAmounts: [TranchedAmounts.TRANCHE_1, TranchedAmounts.TRANCHE_2],
            trancheDurations: [toBn(1000), MAX_U64],
          }),
          "TrancheTimestampOverflow",
        );
      });
    });

    describe("given valid parameters", () => {
      describe("given single tranche", () => {
        it("should create with current_time as start", async () => {
          const currentTime = Time.START;
          const duration = toBn(5000);
          const salt = await ctx.createWithDurationsLt({
            trancheAmounts: [TranchedAmounts.DEPOSIT],
            trancheDurations: [duration],
          });

          const actualStreamData = await ctx.fetchStreamData(salt);
          const expectedTimestamp = currentTime.add(duration);
          const expectedStreamData = ctx.defaultTranchedStream({
            model: TRANCHED_MODEL({
              timestamps: { end: expectedTimestamp, start: currentTime },
              tranches: [{ amount: TranchedAmounts.DEPOSIT, timestamp: expectedTimestamp }],
            }),
            salt,
          }).data;

          assertEqStreamData(actualStreamData, expectedStreamData);
        });
      });

      describe("given multiple tranches", () => {
        it("should create with cumulative timestamps", async () => {
          const currentTime = Time.START;
          const salt = await ctx.createWithDurationsLt();

          const actualStreamData = await ctx.fetchStreamData(salt);

          // Calculate expected timestamps:
          // T1 = currentTime + duration1
          // T2 = T1 + duration2
          // T3 = T2 + duration3
          const t1 = currentTime.add(TranchedDurations.TRANCHE_1);
          const t2 = t1.add(TranchedDurations.TRANCHE_2);
          const t3 = t2.add(TranchedDurations.TRANCHE_3);

          const expectedStreamData = ctx.defaultTranchedStream({
            model: TRANCHED_MODEL({
              timestamps: { end: t3, start: currentTime },
              tranches: [
                { amount: TranchedAmounts.TRANCHE_1, timestamp: t1 },
                { amount: TranchedAmounts.TRANCHE_2, timestamp: t2 },
                { amount: TranchedAmounts.TRANCHE_3, timestamp: t3 },
              ],
            }),
            salt,
          }).data;

          assertEqStreamData(actualStreamData, expectedStreamData);
        });
      });
    });
  });
});
