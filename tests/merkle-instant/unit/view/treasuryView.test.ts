import { PublicKey } from "@solana/web3.js";
import { beforeEach, describe, expect, it } from "vitest";
import { ProgramId } from "../../../../lib/constants";
import { assertEqTreasury } from "../../../common/assertions";
import { MerkleInstantTestContext } from "../../context";
import { Seed } from "../../utils/defaults";

describe("treasuryView", () => {
  let ctx: MerkleInstantTestContext;

  describe("given not initialized", () => {
    it("should fail", async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant({ initProgram: false });
      await expect(ctx.treasuryView()).rejects.toThrow("Cannot read properties of null (reading 'data')");
    });
  });

  describe("given initialized", () => {
    beforeEach(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant();
    });

    it("should return the treasury details", async () => {
      const actualTreasury = await ctx.treasuryView();
      const expectedBump = PublicKey.findProgramAddressSync([Seed.TREASURY], ctx.merkleInstant.programId)[1];
      const expectedTreasury = {
        bump: expectedBump,
        chainlinkProgram: ProgramId.CHAINLINK_PROGRAM,
        chainlinkSolUsdFeed: ProgramId.CHAINLINK_SOL_USD_FEED,
        feeCollector: ctx.feeCollector.keys.publicKey,
      };
      assertEqTreasury(actualTreasury, expectedTreasury);
    });
  });
});
