import { beforeEach, describe, expect, it } from "vitest";
import { sleepFor, toBn } from "../../../lib/helpers";
import { assertAccountExists, assertEqBn } from "../../common/assertions";
import { LockupTestContext } from "../context";

let ctx: LockupTestContext;

describe("initialize", () => {
  beforeEach(async () => {
    ctx = new LockupTestContext();
    await ctx.setUpLockup({ initProgram: false });
  });

  describe("given initialized", () => {
    it("should fail", async () => {
      await ctx.initializeLockup();
      await sleepFor(7);
      await expect(
        ctx.initializeLockup(),
        "Tx succeeded when it should have failed",
      ).rejects.toThrow("Instruction 1: custom program error: 0x0");
    });
  });

  describe("given not initialized", () => {
    it("should initialize the program", async () => {
      await ctx.initializeLockup();

      await assertAccountExists(ctx, ctx.treasuryAddress, "Treasury");

      // Assert that the Stream NFT collection account exists
      const streamNftCollectionAddress = ctx.getStreamNftCollectionAddress();
      await assertAccountExists(ctx, streamNftCollectionAddress, "Stream NFT collection");

      // Assert that the Stream NFT collection has a size of 0
      const streamNftCollectionSize = await ctx.getStreamNftCollectionSize();
      assertEqBn(streamNftCollectionSize, toBn(0), "Stream NFT collection should have a size of 0");
    });
  });
});
