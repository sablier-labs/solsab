import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { REDUNDANCY_BUFFER } from "../../../lib/constants";
import { assertEqBn } from "../../common/assertions";
import { MerkleInstantTestContext } from "../context";
import { expectToThrow } from "../utils/assertions";

let ctx: MerkleInstantTestContext;

describe("collectFees", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant({
        initProgram: false,
      });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.collectFees(), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant();
    });

    describe("when signer is not the authorized fee collector", () => {
      it("should fail", async () => {
        await ctx.simulateFeeGeneration();

        await expectToThrow(ctx.collectFees({ signer: ctx.eve.keys }), CONSTRAINT_ADDRESS);
      });
    });

    describe("when signer is the authorized fee collector", () => {
      describe("given no fees accumulated", () => {
        it("should fail", async () => {
          await expectToThrow(ctx.collectFees(), "CantCollectZeroFees");
        });
      });

      describe("given accumulated fees", () => {
        it("should collect the fees", async () => {
          const fees = await ctx.simulateFeeGeneration();

          const beforeLamports = {
            feeRecipient: await getFeeRecipientLamports(),
            treasury: await ctx.getTreasuryLamports(),
          };

          // Collect the fees
          await ctx.collectFees();

          const afterLamports = {
            feeRecipient: await getFeeRecipientLamports(),
            treasury: await ctx.getTreasuryLamports(),
          };

          const expectedFeesCollected = fees.sub(REDUNDANCY_BUFFER);

          // Assert that the treasury balance has been updated correctly.
          assertEqBn(beforeLamports.treasury.sub(afterLamports.treasury), expectedFeesCollected);

          // Assert that the recipient balance has been updated correctly.
          assertEqBn(
            afterLamports.feeRecipient.sub(beforeLamports.feeRecipient),
            expectedFeesCollected,
          );
        });
      });
    });
  });
});

async function getFeeRecipientLamports() {
  return await ctx.getLamportsOf(ctx.recipient.keys.publicKey);
}
