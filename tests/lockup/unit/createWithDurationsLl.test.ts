import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { ZERO } from "../../../lib/constants";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time } from "../utils/defaults";
import { isLinearModel } from "../utils/types";

let ctx: LockupTestContext;

describe("createWithDurationsLl", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      await ctx.timeTravelTo(Time.START);
    });

    it("should fail", async () => {
      await expectToThrow(ctx.createWithDurationsLl({ salt: ZERO }), ACCOUNT_NOT_INITIALIZED);
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
        const salt = await ctx.createWithDurationsLl();

        const actualStreamData = await ctx.fetchStreamData(salt);
        const expectedStreamData = ctx.defaultStream({ salt: salt }).data;
        assertEqStreamData(actualStreamData, expectedStreamData);
      });
    });

    describe("when cliff duration zero", () => {
      it("it should create the stream", async () => {
        const salt = await ctx.createWithDurationsLl({ cliffDuration: ZERO });

        const actualStreamData = await ctx.fetchStreamData(salt);
        const expectedStreamData = ctx.defaultStream({ salt: salt }).data;
        // Access the model-specific fields
        const model = expectedStreamData.model;
        if (isLinearModel(model)) {
          model.linear.unlocks.cliff = ZERO;
          model.linear.timestamps.cliff = ZERO;
        }
        assertEqStreamData(actualStreamData, expectedStreamData);
      });
    });
  });
});
