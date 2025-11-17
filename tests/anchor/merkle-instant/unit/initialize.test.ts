import { beforeEach, describe, expect, it } from "vitest";
import { sleepFor } from "../../../../lib/helpers";
import { assertAccountExists } from "../../common/assertions";
import { MerkleInstantTestContext } from "../context";

let ctx: MerkleInstantTestContext;

describe("initialize", () => {
  beforeEach(async () => {
    ctx = new MerkleInstantTestContext();
    await ctx.setUpMerkleInstant({
      initProgram: false,
    });
  });

  describe("given initialized", () => {
    it("should fail", async () => {
      await ctx.initializeMerkleInstant();
      await sleepFor(7);
      await expect(ctx.initializeMerkleInstant(), "Tx succeeded when it should have failed").rejects.toThrow(
        "Instruction 1: custom program error: 0x0",
      );
    });
  });

  describe("given not initialized", () => {
    it("should initialize the program", async () => {
      await ctx.initializeMerkleInstant();

      await assertAccountExists(ctx, ctx.treasuryAddress, "Treasury");
    });
  });
});
