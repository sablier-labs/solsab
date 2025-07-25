import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { ZERO } from "../../../lib/constants";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time } from "../utils/defaults";

describe("createWithDurations", () => {
  let ctx: LockupTestContext;

  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      await ctx.timeTravelTo(Time.START);
    });

    it("should revert", async () => {
      await expectToThrow(ctx.createWithDurations({ salt: ZERO }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
      await ctx.timeTravelTo(Time.START);
    });

    describe("when cliff duration not zero", () => {
      it("it should create the stream", async () => {
        const salt = await ctx.createWithDurations();

        const actualStreamData = await ctx.fetchStreamData(salt);
        const expectedStreamData = ctx.defaultStream({ salt: salt }).data;
        assertEqStreamData(actualStreamData, expectedStreamData);
      });
    });

    describe("when cliff duration zero", () => {
      it("it should create the stream", async () => {
        const salt = await ctx.createWithDurations({ cliffDuration: ZERO });

        const actualStreamData = await ctx.fetchStreamData(salt);
        const expectedStreamData = ctx.defaultStream({ salt: salt }).data;
        expectedStreamData.amounts.cliffUnlock = ZERO;
        expectedStreamData.timestamps.cliff = ZERO;
        assertEqStreamData(actualStreamData, expectedStreamData);
      });
    });
  });
});
