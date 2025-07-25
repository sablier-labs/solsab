import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { MIN_LAMPORTS_BALANCE } from "../../../lib/constants";
import { assertEqualBalanceSOL } from "../../common/assertions";
import { eve, getLamportsOf, recipient } from "../../common/base";
import { claim, collectFees, getTreasuryLamports, setUp } from "../base";
import { expectToThrow } from "../utils/assertions";
import { Amount } from "../utils/defaults";

describe("collectFees", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({
        initProgram: false,
      });
    });

    it("should revert", async () => {
      await expectToThrow(collectFees(), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    describe("when signer is not the authorized fee collector", () => {
      it("should revert", async () => {
        // Perform a claim, generating fees
        await claim();

        await expectToThrow(collectFees({ signer: eve.keys }), CONSTRAINT_ADDRESS);
      });
    });

    describe("when signer is the authorized fee collector", () => {
      describe("given no fees accumulated", () => {
        it("should revert", async () => {
          await expectToThrow(collectFees(), "CantCollectZeroFees");
        });
      });

      describe("given accumulated fees", () => {
        it("should collect the fees", async () => {
          // Perform a claim, generating fees
          await claim({ claimerKeys: recipient.keys });

          const beforeLamports = {
            feeRecipient: await getFeeRecipientLamports(),
            treasury: await getTreasuryLamports(),
          };

          // Collect the fees
          await collectFees();

          const afterLamports = {
            feeRecipient: await getFeeRecipientLamports(),
            treasury: await getTreasuryLamports(),
          };

          // 1 claim worth of fees minus the minimum lamports balance (a buffer on top of the minimum rent).
          const expectedFeesCollected = Amount.CLAIM_FEE.sub(MIN_LAMPORTS_BALANCE);

          assertEqualBalanceSOL(afterLamports.treasury, beforeLamports.treasury.sub(expectedFeesCollected));
          assertEqualBalanceSOL(afterLamports.feeRecipient, beforeLamports.feeRecipient.add(expectedFeesCollected));
        });
      });
    });
  });
});

async function getFeeRecipientLamports() {
  return await getLamportsOf(recipient.keys.publicKey);
}
