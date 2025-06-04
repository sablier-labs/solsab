import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { assert, assertErrorHexCode } from "../utils/assertions";
import {
  campaignCreator,
  claim,
  createATAAndMintTo,
  createCampaign,
  deriveATAAddress,
  randomTokenSPL,
  claimToken2022,
  setUp,
  sleepFor,
  timeTravelTo,
  TOKEN_PROGRAM_ID,
  banksClient,
  getPDAAddress,
  campaignIds,
  accountExists,
  fetchCampaignData,
  recipient,
  getATABalance,
  usdc,
  treasuryAddress,
  getLamportsOf,
  dai,
  fundCampaign,
} from "../base";
import { getErrorCode } from "../utils/errors";
import * as defaults from "../utils/defaults";

describe("claim", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp({
        initProgram: false,
      });
    });

    it("should revert", async () => {
      try {
        await claim({ campaignId: recipient.keys.publicKey }); // Passing a non-Campaign account since no Campaigns exist yet

        assert.fail("Expected the tx to revert, but it succeeded.");
      } catch (error) {
        assertErrorHexCode(error, getErrorCode("AccountOwnedByWrongProgram"));
      }
    });
  });

  context("when the program is initialized", () => {
    context("when the campaign doesn't exist", () => {
      beforeEach(async () => {
        await setUp({
          initProgram: true,
          createCampaigns: false,
        });
      });

      it("should revert", async () => {
        try {
          // Claim from a non-existent Campaign
          await claim({ campaignId: new PublicKey(12345) });

          assert.fail("Expected the tx to revert, but it succeeded.");
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });

    context("when the campaign exists", () => {
      beforeEach(async () => {
        await setUp();
      });

      context("when the airdrop has already been claimed", () => {
        it("should revert", async () => {
          await claim();
          await sleepFor(7);
          try {
            // Claim from the Campaign again
            await claim();

            assert.fail("Expected the tx to revert, but it succeeded.");
          } catch (error) {
            assertErrorHexCode(error, "0x0");
          }
        });
      });

      context("when the airdrop has not been claimed", () => {
        context("when the token mint is invalid", () => {
          it("should revert", async () => {
            try {
              // Claim from the Campaign with an invalid token mint
              await claim({ airdropTokenMint: dai });

              assert.fail("Expected the tx to revert, but it succeeded.");
            } catch (error) {
              assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
            }
          });
        });

        context("when the token mint is valid", () => {
          context("when the merkle proof is invalid", () => {
            it("should revert", async () => {
              try {
                await claim({
                  amount: defaults.CLAIM_AMOUNT.sub(new BN(1)), // Invalid amount
                });

                assert.fail("Expected the tx to revert, but it succeeded.");
              } catch (error) {
                assertErrorHexCode(error, getErrorCode("InvalidMerkleProof"));
              }
            });
          });

          context("when the merkle proof is valid", () => {
            context("when the campaign doesn't have enough tokens", () => {
              beforeEach(async () => {
                await setUp({
                  initProgram: true,
                  createCampaigns: true,
                  fundCampaigns: false,
                });
              });

              it("should revert", async () => {
                try {
                  await claim();

                  assert.fail("Expected the tx to revert, but it succeeded.");
                } catch (error) {
                  assertErrorHexCode(error, "0x1");
                }
              });
            });

            context("when the campaign has enough tokens", () => {
              context("when the campaign expired", () => {
                it("should revert", async () => {
                  // Time travel to when the campaign has expired
                  await timeTravelTo(defaults.EXPIRATION_TIME);
                  try {
                    await claim();

                    assert.fail("Expected the tx to revert, but it succeeded.");
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
                      const campaignCreatorAta = await createATAAndMintTo(
                        campaignCreator.keys.publicKey,
                        randomTokenSPL,
                        defaults.AGGREGATE_AMOUNT.toNumber(),
                        TOKEN_PROGRAM_ID
                      );

                      // Create a Campaign with the random token
                      const campaignId = await createCampaign({
                        airdropTokenMint: randomTokenSPL,
                      });

                      await fundCampaign(
                        campaignCreator.keys,
                        campaignId,
                        randomTokenSPL,
                        campaignCreatorAta,
                        TOKEN_PROGRAM_ID,
                        defaults.AGGREGATE_AMOUNT.toNumber()
                      );

                      // Claim from the Campaign
                      await claim();
                    });
                  }
                );

                context("when the recipient has an ATA for the token", () => {
                  context("when the claimer is not the recipient", () => {
                    it("should claim the airdrop", async () => {
                      // Claim from the Campaign
                      await claim({
                        claimerKeys: campaignCreator.keys,
                      });
                    });
                  });

                  context("when the claimer is the recipient", () => {
                    context("given a Token2022 token", () => {
                      it("should claim the airdrop", async () => {
                        // Claim from the Campaign
                        await claimToken2022();
                      });
                    });

                    context("given an SPL token", () => {
                      it("should create the Claim Receipt account", async () => {
                        const claimReceiptAddress = deriveClaimReceiptAddress();

                        // Assert that the Claim Receipt account doesn't exist before claiming
                        assert.isFalse(
                          await accountExists(claimReceiptAddress)
                        );

                        // Claim from the Campaign
                        await claim();

                        // Assert that the Claim Receipt account exists
                        assert(await accountExists(claimReceiptAddress));
                      });

                      it("should set the Campaign's firstClaimTime", async () => {
                        // Get the Campaign's data before claiming
                        const campaignDataBefore = await fetchCampaignData(
                          campaignIds.default
                        );
                        // Assert that the firstClaimTime is not set
                        assert(campaignDataBefore.firstClaimTime.isZero());

                        // Claim from the Campaign
                        await claim();

                        // Get the Campaign's data after claiming
                        const campaignDataAfter = await fetchCampaignData(
                          campaignIds.default
                        );
                        // Assert that the firstClaimTime field is set to the current time
                        const now = new BN(
                          (
                            await banksClient.getClock()
                          ).unixTimestamp.toString()
                        );
                        assert(campaignDataAfter.firstClaimTime.eq(now));
                      });

                      it("should transfer the airdrop from the Campaign to the recipient", async () => {
                        // Get the recipient's balance before claiming
                        const recipientBalanceBefore = await getATABalance(
                          banksClient,
                          recipient.usdcATA
                        );

                        // Derive the ATA of the Campaign
                        const campaignAta = deriveATAAddress(
                          usdc,
                          campaignIds.default,
                          TOKEN_PROGRAM_ID
                        );

                        // Get the balance of the Campaign before claiming
                        const campaignAtaBalanceBefore = await getATABalance(
                          banksClient,
                          campaignAta
                        );

                        // Claim from the Campaign
                        const amountToClaim = defaults.CLAIM_AMOUNT;
                        await claim({ amount: amountToClaim });

                        // Get the recipient's balance after claiming
                        const recipientBalanceAfter = await getATABalance(
                          banksClient,
                          recipient.usdcATA
                        );

                        // Assert that the recipient's balance increased by the claim amount
                        assert(
                          recipientBalanceAfter.eq(
                            recipientBalanceBefore.add(amountToClaim)
                          )
                        );

                        // Get the balance of the Campaign after claiming
                        const campaignAtaBalanceAfter = await getATABalance(
                          banksClient,
                          campaignAta
                        );

                        // Assert that the Campaign's ATA balance decreased by the claim amount
                        assert(
                          campaignAtaBalanceAfter.eq(
                            campaignAtaBalanceBefore.sub(amountToClaim)
                          )
                        );
                      });

                      it("should transfer the claim fee to the treasury", async () => {
                        // Get the treasury's Lamports balance before claiming
                        const treasuryLamportsBefore = await getLamportsOf(
                          treasuryAddress
                        );

                        // Claim from the Campaign
                        await claim();

                        // Get the treasury's Lamports balance after claiming
                        const treasuryLamportsAfter = await getLamportsOf(
                          treasuryAddress
                        );

                        // Assert that the treasury's balance has increased by the claim fee amount
                        assert(
                          treasuryLamportsAfter ==
                            treasuryLamportsBefore +
                              BigInt(defaults.CLAIM_FEE_AMOUNT)
                        );

                        // Dev: we're not asserting the claimer paying the claim fee, because we don't know how big of a tx fee the claimer had to pay
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

function deriveClaimReceiptAddress(
  campaignId: PublicKey = campaignIds.default,
  recipientIndex: number = 0
): PublicKey {
  const indexBuffer = Buffer.alloc(4);
  indexBuffer.writeUInt32LE(recipientIndex); // use LE to match the Rust program

  return getPDAAddress([
    Buffer.from(defaults.CLAIM_RECEIPT_SEED),
    campaignId.toBuffer(),
    indexBuffer,
  ]);
}
