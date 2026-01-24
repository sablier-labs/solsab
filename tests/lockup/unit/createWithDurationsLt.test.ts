import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { MAX_U64, ZERO } from "../../../lib/constants";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time, TRANCHED_MODEL, TranchedAmount, TranchedDuration } from "../utils/defaults";

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
            trancheAmounts: [TranchedAmount.TRANCHE_1, TranchedAmount.TRANCHE_2],
            trancheDurations: [TranchedDuration.TRANCHE_1],
          }),
          "TrancheAmountsDurationsMismatch",
        );
      });

      it("should fail when durations array is longer", async () => {
        await expectToThrow(
          ctx.createWithDurationsLt({
            trancheAmounts: [TranchedAmount.TRANCHE_1],
            trancheDurations: [TranchedDuration.TRANCHE_1, TranchedDuration.TRANCHE_2],
          }),
          "TrancheAmountsDurationsMismatch",
        );
      });
    });

    describe("given duration causes timestamp overflow", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.createWithDurationsLt({
            trancheAmounts: [TranchedAmount.TRANCHE_1, TranchedAmount.TRANCHE_2],
            trancheDurations: [new BN(1000), MAX_U64],
          }),
          "TrancheTimestampOverflow",
        );
      });
    });

    describe("given valid parameters", () => {
      describe("given single tranche", () => {
        it("should create with current_time as start", async () => {
          const currentTime = Time.START;
          const duration = new BN(5000);
          const salt = await ctx.createWithDurationsLt({
            trancheAmounts: [TranchedAmount.DEPOSIT],
            trancheDurations: [duration],
          });

          const actualStreamData = await ctx.fetchStreamData(salt);
          const expectedTimestamp = currentTime.add(duration);
          const expectedStreamData = ctx.defaultTranchedStream({
            model: TRANCHED_MODEL({
              timestamps: { end: expectedTimestamp, start: currentTime },
              tranches: [{ amount: TranchedAmount.DEPOSIT, timestamp: expectedTimestamp }],
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
          const t1 = currentTime.add(TranchedDuration.TRANCHE_1);
          const t2 = t1.add(TranchedDuration.TRANCHE_2);
          const t3 = t2.add(TranchedDuration.TRANCHE_3);

          const expectedStreamData = ctx.defaultTranchedStream({
            model: TRANCHED_MODEL({
              timestamps: { end: t3, start: currentTime },
              tranches: [
                { amount: TranchedAmount.TRANCHE_1, timestamp: t1 },
                { amount: TranchedAmount.TRANCHE_2, timestamp: t2 },
                { amount: TranchedAmount.TRANCHE_3, timestamp: t3 },
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
