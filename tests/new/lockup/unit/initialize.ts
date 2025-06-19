import { BN } from "@coral-xyz/anchor";

import {
  deriveATAAddress,
  getATABalance,
  getMintTotalSupplyOf,
  initializeLockup,
  lockupProgram,
  nftCollectionDataAddress,
  setUp,
  treasuryAddress,
} from "../base";

import {
  accountExists,
  banksClient,
  getPDAAddress,
  sleepFor,
} from "../../common-base";

import { assert, assertErrorHexCode, assertFail } from "../utils/assertions";
import * as defaults from "../utils/defaults";

describe("initialize", () => {
  beforeEach(async () => {
    await setUp(false);
  });

  context("given initialized", () => {
    it("should revert", async () => {
      await initializeLockup();
      await sleepFor(7);
      try {
        await initializeLockup();
        assertFail();
      } catch (error) {
        assertErrorHexCode(error, "0x0");
      }
    });
  });

  context("given not initialized", () => {
    it("should initialize the program", async () => {
      await initializeLockup();

      assert(
        await accountExists(nftCollectionDataAddress),
        "nftCollectionDataAddress is null"
      );

      assert(await accountExists(treasuryAddress), "Treasury not initialized");

      const nftCollectionMint = getPDAAddress(
        [Buffer.from(defaults.NFT_COLLECTION_MINT_SEED)],
        lockupProgram.programId
      );

      assert(
        await accountExists(nftCollectionMint),
        "NFT Collection Mint not initialized"
      );

      // Assert that the Total Supply of the NFT Collection Mint is 1
      const totalSupply = await getMintTotalSupplyOf(
        banksClient,
        nftCollectionMint
      );
      assert(totalSupply.eq(new BN(1)));

      const nftCollectionATA = deriveATAAddress(
        nftCollectionMint,
        treasuryAddress,
        defaults.TOKEN_PROGRAM_ID
      );

      assert(
        await accountExists(nftCollectionATA),
        "NFT Collection ATA not initialized"
      );

      // Assert that the NFT Collection ATA has a balance of 1
      const nftCollectionATABalance = await getATABalance(
        banksClient,
        nftCollectionATA
      );
      assert(nftCollectionATABalance.eq(new BN(1)));

      const nftCollectionMintAsBuffer = nftCollectionMint.toBuffer();

      const nftCollectionMetadata = getPDAAddress(
        [
          Buffer.from(defaults.METADATA_SEED),
          defaults.TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftCollectionMintAsBuffer,
        ],
        defaults.TOKEN_METADATA_PROGRAM_ID
      );

      assert(
        await accountExists(nftCollectionMetadata),
        "NFT Collection Metadata not initialized"
      );

      const nftCollectionMasterEdition = getPDAAddress(
        [
          Buffer.from("metadata"),
          defaults.TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftCollectionMintAsBuffer,
          Buffer.from("edition"),
        ],
        defaults.TOKEN_METADATA_PROGRAM_ID
      );

      assert(
        await accountExists(nftCollectionMasterEdition),
        "NFT Collection Master Edition not initialized"
      );
    });
  });
});
