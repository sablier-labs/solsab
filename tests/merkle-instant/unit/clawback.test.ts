import type { BN } from "@coral-xyz/anchor";
import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { PublicKey } from "@solana/web3.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { ProgramId, ZERO } from "../../../lib/constants";
import { createATAAndFund, deriveATAAddress, getATABalanceMint } from "../../common/anchor-bankrun";
import { assertAccountExists, assertAccountNotExists, assertEqBn } from "../../common/assertions";
import { MerkleInstantTestContext } from "../context";
import { expectToThrow } from "../utils/assertions";
import { Amount, Campaign } from "../utils/defaults";

let ctx: MerkleInstantTestContext;

describe("clawback", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant({
        initProgram: false,
      });
    });

    it("should fail", async () => {
      // Passing a non-Campaign account since no Campaigns exist yet
      await expectToThrow(
        ctx.clawback({ campaign: new PublicKey(12345) }),
        ACCOUNT_NOT_INITIALIZED,
      );
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant();
    });

    describe("when the passed campaign account is invalid", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.clawback({ campaign: new PublicKey(12345) }),
          ACCOUNT_NOT_INITIALIZED,
        );
      });
    });

    describe("when the passed campaign account is valid", () => {
      describe("when the passed mint is invalid", () => {
        it("should fail", async () => {
          await expectToThrow(
            ctx.clawback({
              airdropTokenMint: ctx.dai,
            }),
            ACCOUNT_NOT_INITIALIZED,
          );
        });
      });

      describe("when the passed mint is valid", () => {
        describe("when the signer is not the campaign creator", () => {
          it("should fail", async () => {
            await expectToThrow(
              ctx.clawback({
                signer: ctx.eve.keys,
              }),
              CONSTRAINT_ADDRESS,
            );
          });
        });

        describe("when the signer is the campaign creator", () => {
          describe("when first claim not made", () => {
            it("should clawback", async () => {
              await testClawback();
            });
          });

          describe("when first claim made", () => {
            beforeEach(async () => {
              await ctx.claim();
            });

            describe("given grace period not passed", () => {
              it("should clawback", async () => {
                await testClawback();
              });
            });

            describe("given grace period passed", () => {
              beforeEach(async () => {
                // Time travel to the end of the grace period
                await ctx.timeTravelTo(Campaign.POST_GRACE_PERIOD);
              });

              describe("given campaign not expired", () => {
                it("should fail", async () => {
                  await expectToThrow(ctx.clawback(), "ClawbackNotAllowed");
                });
              });

              describe("given campaign expired", () => {
                beforeEach(async () => {
                  // Time travel to the end of the campaign
                  await ctx.timeTravelTo(Campaign.EXPIRATION_TIME);
                });

                describe("when clawback recipient does not have ATA", () => {
                  it("should clawback", async () => {
                    await createATAAndFund(
                      ctx.banksClient,
                      ctx.defaultBankrunPayer,
                      ctx.randomToken,
                      Amount.AGGREGATE,
                      ProgramId.TOKEN,
                      ctx.campaignCreator.keys.publicKey,
                    );

                    const campaign = await ctx.createCampaign({
                      airdropTokenMint: ctx.randomToken,
                    });

                    const clawbackRecipientAta = deriveATAAddress(
                      ctx.randomToken,
                      ctx.clawbackRecipient.keys.publicKey,
                      ProgramId.TOKEN,
                    );
                    await assertAccountNotExists(
                      ctx,
                      clawbackRecipientAta,
                      "Clawback Recipient's ATA",
                    );

                    // Claim from the Campaign
                    await testClawback({
                      airdropTokenMint: ctx.randomToken,
                      campaign,
                      clawbackRecipientAtaExists: false,
                    });

                    await assertAccountExists(
                      ctx,
                      clawbackRecipientAta,
                      "Clawback Recipient's ATA",
                    );
                  });
                });

                describe("when clawback recipient has ATA", () => {
                  describe("given token SPL standard", () => {
                    it("should clawback", async () => {
                      // Claim from the Campaign
                      await testClawback();
                    });
                  });

                  describe("given token 2022 standard", () => {
                    it("should clawback", async () => {
                      // Test the claim.
                      await testClawback({
                        airdropTokenMint: ctx.dai,
                        airdropTokenProgram: ProgramId.TOKEN_2022,
                        campaign: ctx.defaultCampaignToken2022,
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

async function testClawback({
  campaign = ctx.defaultCampaign,
  airdropTokenMint = ctx.usdc,
  airdropTokenProgram = ProgramId.TOKEN,
  clawbackRecipient = ctx.clawbackRecipient.keys.publicKey,
  clawbackRecipientAtaExists = true,
} = {}) {
  const campaignAtaBalanceBefore = await getATABalanceMint(
    ctx.banksClient,
    campaign,
    airdropTokenMint,
  );
  const clawbackRecipientAtaBalanceBefore: BN = clawbackRecipientAtaExists
    ? await getATABalanceMint(ctx.banksClient, clawbackRecipient, airdropTokenMint)
    : ZERO;

  await ctx.clawback({
    airdropTokenMint,
    airdropTokenProgram,
    amount: Amount.CLAWBACK,
    campaign,
    clawbackRecipient,
  });

  const campaignAtaBalanceAfter = await getATABalanceMint(
    ctx.banksClient,
    campaign,
    airdropTokenMint,
  );

  // Assert that the campaign token balance has decreased as expected
  assertEqBn(campaignAtaBalanceBefore, campaignAtaBalanceAfter.add(Amount.CLAWBACK));

  const clawbackRecipientAtaBalanceAfter = await getATABalanceMint(
    ctx.banksClient,
    clawbackRecipient,
    airdropTokenMint,
  );

  // Assert that the clawback recipient's token balance has increased as expected
  assertEqBn(
    clawbackRecipientAtaBalanceBefore,
    clawbackRecipientAtaBalanceAfter.sub(Amount.CLAWBACK),
  );
}
