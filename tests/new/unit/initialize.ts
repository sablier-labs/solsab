import {
  accountExists,
  deriveATAAddress,
  getPDAAddress,
  initializeSablierLockup,
  lockupProgram,
  nftCollectionDataAddress,
  setUp,
  treasuryAddress,
} from "../base";
import { assert, assertError } from "../utils/assertions";
import * as defaults from "../utils/defaults";

describe("initialize", () => {
  beforeEach(async () => {
    await setUp(false);
  });

  context("given initialized", () => {
    it("should revert", async () => {
      await initializeSablierLockup();
      try {
        await initializeSablierLockup();
      } catch (error) {
        assertError(error, "0x0");
      }
    });
  });

  context("given not initialized", () => {
    it("should initialize the program", async () => {
      await initializeSablierLockup();

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

      const nftCollectionATA = deriveATAAddress(
        nftCollectionMint,
        treasuryAddress
      );

      assert(
        await accountExists(nftCollectionATA),
        "NFT Collection ATA not initialized"
      );

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
