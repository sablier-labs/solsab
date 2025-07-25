import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { assert, beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, ZERO } from "../../../lib/constants";
import { sleepFor } from "../../../lib/helpers";
import { createATAAndFund, getATABalanceMint } from "../../common/anchor-bankrun";
import { assertEqualBalanceSOL, assertEqualBn, assertLteBn, assertZeroBn } from "../../common/assertions";
import {
  banksClient,
  dai,
  defaultBankrunPayer,
  getLamportsOf,
  randomToken,
  recipient,
  timeTravelTo,
  usdc,
} from "../../common/base";
import {
  campaignCreator,
  claim,
  createCampaign,
  defaultCampaign,
  defaultCampaignToken2022,
  defaultIndex,
  fetchCampaignData,
  merkleInstant,
  setUp,
  treasuryAddress,
} from "../base";
import { expectToThrow } from "../utils/assertions";
import { Amount, Time } from "../utils/defaults";

describe("claim", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({
        initProgram: false,
      });
    });
    describe("when the campaign doesn't exist", () => {
      it("should revert", async () => {
        // Passing a non-Campaign account since no Campaigns exist yet
        await expectToThrow(claim({ campaign: new PublicKey(12345) }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("when the campaign exists", () => {
      it("should revert", async () => {
        const campaign = await createCampaign({ name: "Test Campaign" });
        await expectToThrow(claim({ campaign: campaign }), ACCOUNT_NOT_INITIALIZED);
      });
    });
  });

  describe("when the program is initialized", () => {
    describe("when the campaign doesn't exist", () => {
      it("should revert", async () => {
        // Claim from a non-existent Campaign
        await expectToThrow(claim({ campaign: new PublicKey(12345) }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("when the campaign exists", () => {
      beforeEach(async () => {
        await setUp();
      });

      describe("when the token mint is invalid", () => {
        it("should revert", async () => {
          // Claim from the Campaign with an invalid token mint
          await expectToThrow(claim({ airdropTokenMint: dai }), ACCOUNT_NOT_INITIALIZED);
        });
      });

      describe("when the token mint is valid", () => {
        describe("when the airdrop has already been claimed", () => {
          it("should revert", async () => {
            await claim();
            await sleepFor(7);
            // Claim from the Campaign again
            await expectToThrow(claim(), 0x0);
          });
        });

        describe("when the airdrop has not been claimed", () => {
          describe("when the merkle proof is invalid", () => {
            it("should revert", async () => {
              await expectToThrow(
                claim({
                  amount: Amount.CLAIM.sub(BN_1),
                }),
                "InvalidMerkleProof",
              );
            });
          });

          describe("when the merkle proof is valid", () => {
            describe("when the campaign expired", () => {
              it("should revert", async () => {
                // Time travel to when the campaign has expired
                await timeTravelTo(Time.EXPIRATION);
                await expectToThrow(claim(), "CampaignExpired");
              });
            });

            describe("when the campaign has not expired", () => {
              describe("when the recipient doesn't have an ATA for the token", () => {
                it("should claim the airdrop", async () => {
                  // Mint the random token to the campaign creator
                  await createATAAndFund(
                    banksClient,
                    defaultBankrunPayer,
                    randomToken,
                    Amount.AGGREGATE,
                    TOKEN_PROGRAM_ID,
                    campaignCreator.keys.publicKey,
                  );

                  // Create a Campaign with the random token
                  const campaign = await createCampaign({
                    airdropTokenMint: randomToken,
                  });

                  // Test the campaign
                  await testClaim(campaign, recipient.keys, randomToken, TOKEN_PROGRAM_ID, false);
                });
              });

              describe("when the recipient has an ATA for the token", () => {
                describe("when the claimer is not the recipient", () => {
                  it("should claim the airdrop", async () => {
                    // Test the claim.
                    await testClaim(defaultCampaign, campaignCreator.keys);
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
                      await testClaim(defaultCampaignToken2022, recipient.keys, dai, TOKEN_2022_PROGRAM_ID);
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
  campaign = defaultCampaign,
  claimer = recipient.keys,
  tokenMint = usdc,
  tokenProgram = TOKEN_PROGRAM_ID,
  recipientAtaExists = true,
): Promise<void> {
  // Assert that the claim was not made yet.
  assert.isFalse(await hasClaimed());

  // Get the Campaign's data before claiming
  const campaignDataBefore = await fetchCampaignData(campaign);

  // Assert that the Campaign's firstClaimTime is zero before claiming
  assertZeroBn(campaignDataBefore.firstClaimTime);

  // Get the campaign and recipient ATA balances before claiming.
  const campaignAtaBalanceBefore = await getATABalanceMint(banksClient, campaign, tokenMint);
  const recipientAtaBalanceBefore = recipientAtaExists
    ? await getATABalanceMint(banksClient, recipient.keys.publicKey, tokenMint)
    : ZERO;

  // Get the claimer and treasury lamports balance before claiming
  const claimerLamportsBefore = await getLamportsOf(claimer.publicKey);
  const treasuryLamportsBefore = await getLamportsOf(treasuryAddress);

  // Claim from the Campaign
  await claim({
    airdropTokenMint: tokenMint,
    airdropTokenProgram: tokenProgram,
    campaign: campaign,
    claimerKeys: claimer,
  });

  const campaignDataAfter = await fetchCampaignData(campaign);
  assertEqualBn(campaignDataAfter.firstClaimTime, Time.GENESIS);

  // Assert that the claim has been made
  assert.isTrue(await hasClaimed(campaign));

  const campaignAtaBalanceAfter = await getATABalanceMint(banksClient, campaign, tokenMint);

  // Assert that the Campaign's ATA balance decreased by the claim amount
  assertEqualBn(campaignAtaBalanceAfter, campaignAtaBalanceBefore.sub(Amount.CLAIM));

  const recipientAtaBalanceAfter = await getATABalanceMint(banksClient, recipient.keys.publicKey, tokenMint);

  // Assert that the recipient's ATA balance increased by the claim amount
  assertEqualBn(recipientAtaBalanceAfter, recipientAtaBalanceBefore.add(Amount.CLAIM));

  const claimerLamportsAfter = await getLamportsOf(claimer.publicKey);

  // Assert that the claimer's lamports balance has changed at least by the claim fee amount.
  // We use `<=` because we don't know in advance the gas cost.
  assertLteBn(claimerLamportsAfter, claimerLamportsBefore.sub(Amount.CLAIM_FEE));

  const treasuryLamportsAfter = await getLamportsOf(treasuryAddress);

  // Assert that the treasury's balance has increased by the claim fee amount
  assertEqualBalanceSOL(treasuryLamportsAfter, treasuryLamportsBefore.add(Amount.CLAIM_FEE));
}

// Implicitly tests the `has_claimed` Ix works.
async function hasClaimed(campaign = defaultCampaign): Promise<boolean> {
  return await merkleInstant.methods
    .hasClaimed(defaultIndex)
    .accounts({
      campaign: campaign,
    })
    .signers([defaultBankrunPayer])
    .view();
}
