import { beforeEach, describe, expect, it } from "vitest";
import { BN_1, ProgramId } from "../../../lib/constants";
import { getPDAAddress, sleepFor } from "../../../lib/helpers";
import { deriveATAAddress, getATABalance, getMintTotalSupplyOf } from "../../common/anchor-bankrun";
import { assertAccountExists, assertEqualBn } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { Seed } from "../utils/defaults";

let ctx: LockupTestContext;

describe("initialize", () => {
  beforeEach(async () => {
    ctx = new LockupTestContext();
    await ctx.setUpLockup({ initProgram: false });
  });

  describe("given initialized", () => {
    it("should revert", async () => {
      await ctx.initializeLockup();
      await sleepFor(7);
      await expect(ctx.initializeLockup(), "Tx succeeded when it should have reverted").rejects.toThrow(
        "Instruction 1: custom program error: 0x0",
      );
    });
  });

  describe("given not initialized", () => {
    it("should initialize the program", async () => {
      await ctx.initializeLockup();

      await assertAccountExists(ctx, ctx.nftCollectionDataAddress, "NFT Collection Data");
      await assertAccountExists(ctx, ctx.treasuryAddress, "Treasury");

      const nftCollectionMint = getPDAAddress([Seed.NFT_COLLECTION_MINT], ctx.lockup.programId);
      await assertAccountExists(ctx, nftCollectionMint, "NFT Collection Mint");

      // Assert that the Total Supply of the NFT Collection Mint is 1
      const totalSupply = await getMintTotalSupplyOf(ctx.banksClient, nftCollectionMint);
      assertEqualBn(totalSupply, BN_1);

      const nftCollectionATA = deriveATAAddress(nftCollectionMint, ctx.treasuryAddress, ProgramId.TOKEN);
      await assertAccountExists(ctx, nftCollectionATA, "NFT Collection ATA");

      // Assert that the NFT Collection ATA has a balance of 1
      const nftCollectionATABalance = await getATABalance(ctx.banksClient, nftCollectionATA);
      assertEqualBn(nftCollectionATABalance, BN_1);

      const nftCollectionMintAsBuffer = nftCollectionMint.toBuffer();

      const nftCollectionMetadata = getPDAAddress(
        [Seed.METADATA, ProgramId.TOKEN_METADATA.toBuffer(), nftCollectionMintAsBuffer],
        ProgramId.TOKEN_METADATA,
      );
      await assertAccountExists(ctx, nftCollectionMetadata, "NFT Collection Metadata");

      const nftCollectionMasterEdition = getPDAAddress(
        [Seed.METADATA, ProgramId.TOKEN_METADATA.toBuffer(), nftCollectionMintAsBuffer, Seed.EDITION],
        ProgramId.TOKEN_METADATA,
      );
      await assertAccountExists(ctx, nftCollectionMasterEdition, "NFT Collection Master Edition");
    });
  });
});
