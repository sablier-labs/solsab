import { beforeEach, describe, expect, it } from "vitest";
import { sleepFor } from "../../../lib/helpers";
import { assertAccountExists } from "../../common/assertions";
import { initializeMerkleInstant, setUp, treasuryAddress } from "../base";

describe("initialize", () => {
  beforeEach(async () => {
    await setUp({
      initProgram: false,
    });
  });

  describe("given initialized", () => {
    it("should revert", async () => {
      await initializeMerkleInstant();
      await sleepFor(7);
      await expect(initializeMerkleInstant(), "Tx succeeded when it should have reverted").rejects.toThrow("0x0");
    });
  });

  describe("given not initialized", () => {
    it("should initialize the program", async () => {
      await initializeMerkleInstant();

      await assertAccountExists(treasuryAddress, "Treasury");
    });
  });
});
