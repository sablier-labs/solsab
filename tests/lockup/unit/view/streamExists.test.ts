import { assert, beforeEach, describe, it } from "vitest";
import { LockupTestContext } from "../../context";

let ctx: LockupTestContext;

describe("streamExists", () => {
  beforeEach(async () => {
    ctx = new LockupTestContext();
    await ctx.setUpLockup();
  });

  describe("given a null stream", () => {
    it("should return false", async () => {
      assert.isFalse(await ctx.streamExists(ctx.salts.nonExisting));
    });
  });

  describe("given a valid stream", () => {
    it("should return true", async () => {
      assert.isTrue(await ctx.streamExists());
    });
  });
});
