import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { REDUNDANCY_BUFFER } from "../../../lib/constants";
import { assertEqualSOLBalance } from "../../common/assertions";
import { MerkleInstantTestContext } from "../context";
import { expectToThrow } from "../utils/assertions";
import { Amount } from "../utils/defaults";

describe("collectFees", () => {
  let ctx: MerkleInstantTestContext;

  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant({
        initProgram: false,
      });
    });

    it("should revert", async () => {
      await expectToThrow(ctx.collectFees(), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant();
    });

    describe("when signer is not the authorized fee collector", () => {
      it("should revert", async () => {
        // Perform a claim, generating fees
        await ctx.claim();

        await expectToThrow(ctx.collectFees({ signer: ctx.eve.keys }), CONSTRAINT_ADDRESS);
      });
    });

    describe("when signer is the authorized fee collector", () => {
      describe("given no fees accumulated", () => {
        it("should revert", async () => {
          await expectToThrow(ctx.collectFees(), "CantCollectZeroFees");
        });
      });

      describe("given accumulated fees", () => {
        it("should collect the fees", async () => {
          // Perform a claim, generating fees
          await ctx.claim({ claimerKeys: ctx.recipient.keys });

          const beforeLamports = {
            feeRecipient: await getFeeRecipientLamports(ctx),
            treasury: await ctx.getTreasuryLamports(),
          };

          // Collect the fees
          await ctx.collectFees();

          const afterLamports = {
            feeRecipient: await getFeeRecipientLamports(ctx),
            treasury: await ctx.getTreasuryLamports(),
          };

          // 1 claim worth of fees minus the minimum lamports balance (a buffer on top of the redundancy buffer).
          const expectedFeesCollected = Amount.CLAIM_FEE.sub(REDUNDANCY_BUFFER);

          assertEqualSOLBalance(afterLamports.treasury, beforeLamports.treasury.sub(expectedFeesCollected));
          assertEqualSOLBalance(afterLamports.feeRecipient, beforeLamports.feeRecipient.add(expectedFeesCollected));
        });
      });
    });
  });
});

async function getFeeRecipientLamports(ctx: MerkleInstantTestContext) {
  return await ctx.getLamportsOf(ctx.recipient.keys.publicKey);
}
