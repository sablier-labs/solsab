import { claim, collectFees, getTreasuryLamports, setUp } from "../base";
import { eve, getLamportsOf, recipient } from "../../common-base";
import { assert, assertErrorHexCode, assertFail } from "../utils/assertions";
import { getErrorCode } from "../utils/errors";
import * as defaults from "../utils/defaults";

describe("collectFees", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp({
        initProgram: false,
      });
    });

    it("should revert", async () => {
      try {
        await collectFees();
        assertFail();
      } catch (error) {
        assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
      }
    });
  });

  context("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    context("when signer is not the authorized fee collector", () => {
      it("should revert", async () => {
        // Perform a claim, generating fees
        await claim();

        try {
          await collectFees({ signer: eve.keys });
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("ConstraintAddress"));
        }
      });
    });

    context("when signer is the authorized fee collector", () => {
      context("given no fees accumulated", () => {
        it("should revert", async () => {
          try {
            await collectFees();
            assertFail();
          } catch (error) {
            assertErrorHexCode(error, getErrorCode("CantCollectZeroFees"));
          }
        });
      });

      context("given accumulated fees", () => {
        it("should collect the fees", async () => {
          // Perform a claim, generating fees
          await claim({ claimerKeys: recipient.keys });

          const treasuryLamportsBefore = await getTreasuryLamports();
          const feeRecipientLamportsBefore = await getFeeRecipientLamports();

          // Collect the fees
          await collectFees();

          const treasuryLamportsAfter = await getTreasuryLamports();
          const feeRecipientLamportsAfter = await getFeeRecipientLamports();

          const expectedFeesCollected = defaults.CLAIM_FEE_AMOUNT - 1_000_000; // 1 claim worth of fees minus the safety buffer

          assert(
            treasuryLamportsAfter ===
              treasuryLamportsBefore - BigInt(expectedFeesCollected)
          );
          assert(
            feeRecipientLamportsAfter ===
              feeRecipientLamportsBefore + BigInt(expectedFeesCollected)
          );
        });
      });
    });
  });
});

async function getFeeRecipientLamports() {
  return await getLamportsOf(recipient.keys.publicKey);
}
