import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { PublicKey } from "@solana/web3.js";
import { assert, beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, ProgramId, ZERO } from "../../../../lib/constants";
import { sleepFor } from "../../../../lib/helpers";
import { createATAAndFund, getATABalanceMint } from "../../common/anchor-bankrun";
import { assertEqBn, assertLteBn, assertZeroBn } from "../../common/assertions";
import { MerkleInstantTestContext } from "../context";
import { expectToThrow } from "../utils/assertions";
import { Amount, Campaign, Time } from "../utils/defaults";

let ctx: MerkleInstantTestContext;

describe("claim", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant({
        initProgram: false,
      });
    });

    describe("when the campaign doesn't exist", () => {
      it("should fail", async () => {
        // Passing a non-Campaign account since no Campaigns exist yet
        await expectToThrow(ctx.claim({ campaign: new PublicKey(12345) }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("when the campaign exists", () => {
      it("should fail", async () => {
        const campaign = await ctx.createCampaign({ name: "Test Campaign" });
        await expectToThrow(ctx.claim({ campaign: campaign }), ACCOUNT_NOT_INITIALIZED);
      });
    });
  });

  describe("when the program is initialized", () => {
    describe("when the campaign doesn't exist", () => {
      it("should fail", async () => {
        // Claim from a non-existent Campaign
        await expectToThrow(ctx.claim({ campaign: new PublicKey(12345) }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("when the campaign exists", () => {
      beforeEach(async () => {
        ctx = new MerkleInstantTestContext();
        await ctx.setUpMerkleInstant();
      });

      describe("when the token mint is invalid", () => {
        it("should fail", async () => {
          // Claim from the Campaign with an invalid token mint
          await expectToThrow(ctx.claim({ airdropTokenMint: ctx.dai }), ACCOUNT_NOT_INITIALIZED);
        });
      });

      describe("when the token mint is valid", () => {
        describe("when the airdrop has already been claimed", () => {
          it("should fail", async () => {
            await ctx.claim();
            await sleepFor(7);

            // Claim from the Campaign again
            await expectToThrow(ctx.claim(), 0x0);
          });
        });

        describe("when the airdrop has not been claimed", () => {
          describe("when the merkle proof is invalid", () => {
            it("should fail", async () => {
              await expectToThrow(
                ctx.claim({
                  amount: Amount.CLAIM.sub(BN_1),
                }),
                "InvalidMerkleProof",
              );
            });
          });

          describe("when the merkle proof is valid", () => {
            describe("when the campaign start time is in the future", () => {
              it("should fail", async () => {
                // Time travel to before the campaign start time
                await ctx.timeTravelTo(Campaign.START_TIME.sub(BN_1));

                await expectToThrow(ctx.claim(), "CampaignNotStarted");
              });
            });

            describe("when the campaign start time is not in the future", () => {
              describe("when the campaign expired", () => {
                it("should fail", async () => {
                  // Time travel to when the campaign has expired
                  await ctx.timeTravelTo(Campaign.EXPIRATION_TIME);
                  await expectToThrow(ctx.claim(), "CampaignExpired");
                });
              });

              describe("when the campaign has not expired", () => {
                describe("when the recipient doesn't have an ATA for the token", () => {
                  it("should claim the airdrop", async () => {
                    // Mint the random token to the campaign creator
                    await createATAAndFund(
                      ctx.banksClient,
                      ctx.defaultBankrunPayer,
                      ctx.randomToken,
                      Amount.AGGREGATE,
                      ProgramId.TOKEN,
                      ctx.campaignCreator.keys.publicKey,
                    );

                    // Create a Campaign with the random token
                    const campaign = await ctx.createCampaign({
                      airdropTokenMint: ctx.randomToken,
                    });

                    // Test the campaign
                    await testClaim(campaign, ctx.recipient.keys, ctx.randomToken, ProgramId.TOKEN, false);
                  });
                });

                describe("when the recipient has an ATA for the token", () => {
                  describe("when the claimer is not the recipient", () => {
                    it("should claim the airdrop", async () => {
                      // Test the claim.
                      await testClaim(ctx.defaultCampaign, ctx.campaignCreator.keys);
                    });
                  });

                  describe("when the claimer is the recipient", () => {
                    describe("given token SPL standard", () => {
                      it("should claim the airdrop", async () => {
                        // Claim from the Campaign
                        await testClaim();
                      });
                    });

                    describe("given token 2022 standard", () => {
                      it("should claim the airdrop", async () => {
                        // Test the claim.
                        await testClaim(
                          ctx.defaultCampaignToken2022,
                          ctx.recipient.keys,
                          ctx.dai,
                          ProgramId.TOKEN_2022,
                        );
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

/// Common test function to test the claim functionality
async function testClaim(
  campaign = ctx.defaultCampaign,
  claimer = ctx.recipient.keys,
  tokenMint = ctx.usdc,
  tokenProgram = ProgramId.TOKEN,
  recipientAtaExists = true,
): Promise<void> {
  // Assert that the claim was not made yet.
  assert.isFalse(await hasClaimed());

  // Get the Campaign's data before claiming
  const campaignDataBefore = await ctx.fetchCampaignData(campaign);

  // Assert that the Campaign's firstClaimTime is zero before claiming
  assertZeroBn(campaignDataBefore.firstClaimTime);

  // Get the campaign and recipient ATA balances before claiming.
  const campaignAtaBalanceBefore = await getATABalanceMint(ctx.banksClient, campaign, tokenMint);
  const recipientAtaBalanceBefore = recipientAtaExists
    ? await getATABalanceMint(ctx.banksClient, ctx.recipient.keys.publicKey, tokenMint)
    : ZERO;

  // Get the claimer and treasury lamports balance before claiming
  const claimerLamportsBefore = await ctx.getLamportsOf(claimer.publicKey);
  const treasuryLamportsBefore = await ctx.getLamportsOf(ctx.treasuryAddress);

  // Claim from the Campaign
  await ctx.claim({
    airdropTokenMint: tokenMint,
    airdropTokenProgram: tokenProgram,
    campaign: campaign,
    claimerKeys: claimer,
  });

  const campaignDataAfter = await ctx.fetchCampaignData(campaign);
  assertEqBn(campaignDataAfter.firstClaimTime, Time.GENESIS);

  // Assert that the claim has been made
  assert.isTrue(await hasClaimed(campaign));

  const campaignAtaBalanceAfter = await getATABalanceMint(ctx.banksClient, campaign, tokenMint);

  // Assert that the Campaign's ATA balance decreased by the claim amount
  assertEqBn(campaignAtaBalanceAfter, campaignAtaBalanceBefore.sub(Amount.CLAIM));

  const recipientAtaBalanceAfter = await getATABalanceMint(ctx.banksClient, ctx.recipient.keys.publicKey, tokenMint);

  // Assert that the recipient's ATA balance increased by the claim amount
  assertEqBn(recipientAtaBalanceAfter, recipientAtaBalanceBefore.add(Amount.CLAIM));

  const expectedFee = await ctx.claimFeeInLamports();
  const claimerLamportsAfter = await ctx.getLamportsOf(claimer.publicKey);

  // Assert that the claimer's lamports balance has decreased by, at least, the claim fee amount.
  // We use `<=` because we don't know the gas cost in advance.
  assertLteBn(claimerLamportsAfter, claimerLamportsBefore.sub(expectedFee));

  const treasuryLamportsAfter = await ctx.getLamportsOf(ctx.treasuryAddress);

  // Assert that the Treasury has been credited with the claim fee.
  assertEqBn(treasuryLamportsAfter, treasuryLamportsBefore.add(expectedFee));
}

// Implicitly tests the `has_claimed` Ix works.
async function hasClaimed(campaign = ctx.defaultCampaign): Promise<boolean> {
  return await ctx.merkleInstant.methods
    .hasClaimed(ctx.defaultIndex)
    .accounts({
      campaign: campaign,
    })
    .signers([ctx.defaultBankrunPayer])
    .view();
}
