import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { REDUNDANCY_BUFFER } from "../../../../lib/constants";
import { assertLteBn } from "../../common/assertions";
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
        // Perform a claim, generating fees
        await ctx.claim();

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
          // Perform a claim, generating fees
          await ctx.claim({ claimerKeys: ctx.recipient.keys });

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

          const expectedClaimFee = await ctx.claimFeeInLamports();
          const expectedFeesCollected = expectedClaimFee.sub(REDUNDANCY_BUFFER); // 1 claim worth of fees minus the redundancy buffer

          // Assert that the Treasury has been debited with an amount that is within 5% of the expected amount
          const treasuryBalanceDifference = beforeLamports.treasury.sub(afterLamports.treasury).abs();
          assertLteBn(
            treasuryBalanceDifference.sub(expectedFeesCollected).abs(),
            expectedFeesCollected.mul(new BN(5)).div(new BN(100)),
          );

          // Assert that the fee recipient has been credited with an amount that is within 5% of the expected amount
          const feeRecipientBalanceDifference = afterLamports.feeRecipient.sub(beforeLamports.feeRecipient).abs();
          assertLteBn(
            feeRecipientBalanceDifference.sub(expectedFeesCollected).abs(),
            expectedFeesCollected.mul(new BN(5)).div(new BN(100)),
          );
        });
      });
    });
  });
});

async function getFeeRecipientLamports() {
  return await ctx.getLamportsOf(ctx.recipient.keys.publicKey);
}
