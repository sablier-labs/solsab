import { beforeEach, describe, expect, it } from "vitest";
import { BN_1 } from "../../../lib/constants";
import { getPDAAddress, sleepFor } from "../../../lib/helpers";
import { assertAccountExists, assertEqualBn } from "../../common/assertions";
import { banksClient } from "../../common/base";
import {
  deriveATAAddress,
  getATABalance,
  getMintTotalSupplyOf,
  initializeLockup,
  lockup,
  nftCollectionDataAddress,
  setUp,
  treasuryAddress,
} from "../base";
import { ProgramId, Seed } from "../utils/defaults";

describe("initialize", () => {
  beforeEach(async () => {
    await setUp({ initProgram: false });
  });

  describe("given initialized", () => {
    it("should revert", async () => {
      await initializeLockup();
      await sleepFor(7);
      await expect(initializeLockup(), "Tx succeeded when it should have reverted").rejects.toThrow("0x0");
    });
  });

  describe("given not initialized", () => {
    it("should initialize the program", async () => {
      await initializeLockup();

      await assertAccountExists(nftCollectionDataAddress, "NFT Collection Data");
      await assertAccountExists(treasuryAddress, "Treasury");

      const nftCollectionMint = getPDAAddress([Seed.NFT_COLLECTION_MINT], lockup.programId);
      await assertAccountExists(nftCollectionMint, "NFT Collection Mint");

      // Assert that the Total Supply of the NFT Collection Mint is 1
      const totalSupply = await getMintTotalSupplyOf(banksClient, nftCollectionMint);
      assertEqualBn(totalSupply, BN_1);

      const nftCollectionATA = deriveATAAddress(nftCollectionMint, treasuryAddress, ProgramId.TOKEN);
      await assertAccountExists(nftCollectionATA, "NFT Collection ATA");

      // Assert that the NFT Collection ATA has a balance of 1
      const nftCollectionATABalance = await getATABalance(banksClient, nftCollectionATA);
      assertEqualBn(nftCollectionATABalance, BN_1);

      const nftCollectionMintAsBuffer = nftCollectionMint.toBuffer();

      const nftCollectionMetadata = getPDAAddress(
        [Seed.METADATA, ProgramId.TOKEN_METADATA.toBuffer(), nftCollectionMintAsBuffer],
        ProgramId.TOKEN_METADATA,
      );
      await assertAccountExists(nftCollectionMetadata, "NFT Collection Metadata");

      const nftCollectionMasterEdition = getPDAAddress(
        [Seed.METADATA, ProgramId.TOKEN_METADATA.toBuffer(), nftCollectionMintAsBuffer, Seed.EDITION],
        ProgramId.TOKEN_METADATA,
      );
      await assertAccountExists(nftCollectionMasterEdition, "NFT Collection Master Edition");
    });
  });
});
