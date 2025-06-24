import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

import {
  createATAAndFund,
  getATABalanceMint,
} from "../../anchor-bankrun-adapter";
import {
  campaignCreator,
  claim,
  createCampaign,
  defaultCampaign,
  defaultCampaignToken2022,
  setUp,
  defaultIndex,
  fetchCampaignData,
  merkleInstant,
  treasuryAddress,
} from "../base";
import {
  accountExists,
  banksClient,
  defaultBankrunPayer,
  randomToken,
  getLamportsOf,
  dai,
  getPDAAddress,
  recipient,
  sleepFor,
  timeTravelTo,
  usdc,
} from "../../common-base";
import { assert, assertErrorHexCode, assertFail } from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";

describe("claim", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp({
        initProgram: false,
      });
    });
    context("when the campaign doesn't exist", () => {
      it("should revert", async () => {
        try {
          // Passing a non-Campaign account since no Campaigns exist yet
          await claim({ campaign: new PublicKey(12345) });
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });

    context("when the campaign exists", () => {
      it("should revert", async () => {
        const campaign = await createCampaign({ name: "Test Campaign" });
        try {
          await claim({ campaign: campaign });
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });
  });

  context("when the program is initialized", () => {
    context("when the campaign doesn't exist", () => {
      it("should revert", async () => {
        try {
          // Claim from a non-existent Campaign
          await claim({ campaign: new PublicKey(12345) });
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });

    context("when the campaign exists", () => {
      beforeEach(async () => {
        await setUp();
      });

      context("when the token mint is invalid", () => {
        it("should revert", async () => {
          try {
            // Claim from the Campaign with an invalid token mint
            await claim({ airdropTokenMint: dai });
            assertFail();
          } catch (error) {
            assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
          }
        });
      });

      context("when the token mint is valid", () => {
        context("when the airdrop has already been claimed", () => {
          it("should revert", async () => {
            await claim();
            await sleepFor(7);
            try {
              // Claim from the Campaign again
              await claim();
              assertFail();
            } catch (error) {
              assertErrorHexCode(error, "0x0");
            }
          });
        });

        context("when the airdrop has not been claimed", () => {
          context("when the merkle proof is invalid", () => {
            it("should revert", async () => {
              try {
                await claim({
                  index: 100, // Invalid index
                });
                assertFail();
              } catch (error) {
                assertErrorHexCode(error, getErrorCode("InvalidMerkleProof"));
              }
            });
          });

          context("when the merkle proof is valid", () => {
            context("when the campaign expired", () => {
              it("should revert", async () => {
                // Time travel to when the campaign has expired
                await timeTravelTo(defaults.EXPIRATION_TIME);
                try {
                  await claim();
                  assertFail();
                } catch (error) {
                  assertErrorHexCode(error, getErrorCode("CampaignExpired"));
                }
              });
            });

            context("when the campaign has not expired", () => {
              context(
                "when the recipient doesn't have an ATA for the token",
                () => {
                  it("should claim the airdrop", async () => {
                    // Mint the random token to the campaign creator
                    await createATAAndFund(
                      banksClient,
                      defaultBankrunPayer,
                      randomToken,
                      defaults.AGGREGATE_AMOUNT.toNumber(),
                      TOKEN_PROGRAM_ID,
                      campaignCreator.keys.publicKey
                    );

                    // Create a Campaign with the random token
                    const campaign = await createCampaign({
                      airdropTokenMint: randomToken,
                    });

                    // Test the campaign
                    await testClaim(
                      campaign,
                      recipient.keys,
                      randomToken,
                      TOKEN_PROGRAM_ID
                    );
                  });
                }
              );

              context("when the recipient has an ATA for the token", () => {
                context("when the claimer is not the recipient", () => {
                  it("should claim the airdrop", async () => {
                    // Test the claim.
                    await testClaim(defaultCampaign, campaignCreator.keys);
                  });
                });

                context("when the claimer is the recipient", () => {
                  context("given token SPL standard", () => {
                    it("should claim the airdrop", async () => {
                      // Claim from the Campaign
                      await testClaim();
                    });
                  });

                  context("given token 2022 standard", () => {
                    it("should claim the airdrop", async () => {
                      // Test the claim.
                      await testClaim(
                        defaultCampaignToken2022,
                        recipient.keys,
                        dai,
                        TOKEN_2022_PROGRAM_ID
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

/// Common test function to test the claim functionality
async function testClaim(
  campaign = defaultCampaign,
  claimer = recipient.keys,
  tokenMint = usdc,
  tokenProgram = TOKEN_PROGRAM_ID
) {
  // Assert that the claim has not been made
  assert.isFalse(await hasClaimed());

  // Get the Campaign's data before claiming
  const campaignDataBefore = await fetchCampaignData(campaign);

  // Assert that the Campaign's firstClaimTime is zero before claiming
  assert(campaignDataBefore.firstClaimTime.isZero());

  const campaignAtaBalanceBefore = await getATABalanceMint(
    banksClient,
    campaign,
    tokenMint
  );

  // Get the recipient's balance before claiming
  const recipientAtaBalanceBefore = tokenMint.equals(randomToken)
    ? new BN(0)
    : await getATABalanceMint(banksClient, recipient.keys.publicKey, tokenMint);

  // Get the treasury's Lamports balance before claiming
  const treasuryLamportsBefore = await getLamportsOf(treasuryAddress);

  // Claim from the Campaign
  await claim({
    campaign: campaign,
    claimerKeys: claimer,
    airdropTokenMint: tokenMint,
    airdropTokenProgram: tokenProgram,
  });

  const campaignDataAfter = await fetchCampaignData(campaign);
  assert(campaignDataAfter.firstClaimTime.eq(defaults.APR_1_2025));

  // Assert that the claim has been made
  assert(await hasClaimed(campaign));

  const campaignAtaBalanceAfter = await getATABalanceMint(
    banksClient,
    campaign,
    tokenMint
  );

  // Assert that the Campaign's ATA balance decreased by the claim amount
  assert(
    campaignAtaBalanceAfter.eq(
      campaignAtaBalanceBefore.sub(defaults.CLAIM_AMOUNT)
    ),
    "campaign ATA balance"
  );

  const recipientAtaBalanceAfter = await getATABalanceMint(
    banksClient,
    recipient.keys.publicKey,
    tokenMint
  );

  // Assert that the recipient's ATA balance increased by the claim amount
  assert(
    recipientAtaBalanceAfter.eq(
      recipientAtaBalanceBefore.add(defaults.CLAIM_AMOUNT)
    ),
    "recipient ATA balance"
  );

  const treasuryLamportsAfter = await getLamportsOf(treasuryAddress);

  // Assert that the treasury's balance has increased by the claim fee amount
  assert(
    treasuryLamportsAfter ==
      treasuryLamportsBefore + BigInt(defaults.CLAIM_FEE_AMOUNT),
    "treasury balance"
  );
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
