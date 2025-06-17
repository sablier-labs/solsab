import {
  accountExists,
  initializeMerkleInstant as initializeMerkleInstant,
  setUp,
  sleepFor,
  treasuryAddress,
} from "../base";
import { assert, assertErrorHexCode, assertFail } from "../utils/assertions";

describe("initialize", () => {
  beforeEach(async () => {
    await setUp({
      initProgram: false,
    });
  });

  context("given initialized", () => {
    it("should revert", async () => {
      await initializeMerkleInstant();
      await sleepFor(7);
      try {
        await initializeMerkleInstant();
        assertFail();
      } catch (error) {
        assertErrorHexCode(error, "0x0");
      }
    });
  });

  context("given not initialized", () => {
    it("should initialize the program", async () => {
      await initializeMerkleInstant();

      assert(await accountExists(treasuryAddress), "Treasury not initialized");
    });
  });
});
