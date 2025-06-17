import { BN } from "@coral-xyz/anchor";

import {
  setUp,
  clawback,
  recipient,
  treasuryAddress,
  dai,
  claim,
  timeTravelTo,
  TOKEN_2022_PROGRAM_ID,
  campaignIds,
  usdc,
  campaignCreator,
  getATABalance,
  banksClient,
  deriveATAAddress,
  TOKEN_PROGRAM_ID,
  eve,
} from "../base";
import * as defaults from "../utils/defaults";
import { assert, assertErrorHexCode, assertFail } from "../utils/assertions";
import { getErrorCode } from "../utils/errors";

describe("createCampaign", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp({
        initProgram: false,
      });
    });

    it("should revert", async () => {
      try {
        await clawback({ campaign: recipient.keys.publicKey }); // Passing a non-Campaign account since no Campaigns exist yet
        assertFail();
      } catch (error) {
        assertErrorHexCode(error, getErrorCode("AccountOwnedByWrongProgram"));
      }
    });

    context("when the program is initialized", () => {
      beforeEach(async () => {
        await setUp();
      });

      context("when the passed campaign account is invalid", () => {
        it("should revert", async () => {
          try {
            await clawback({ campaign: treasuryAddress });
            assertFail();
          } catch (error) {
            assertErrorHexCode(
              error,
              getErrorCode("AccountDiscriminatorMismatch")
            );
          }
        });

        context("when the passed campaign account is valid", () => {
          context("when the passed mint is invalid", () => {
            it("should revert", async () => {
              try {
                await clawback({
                  airdropTokenMint: dai,
                });
                assertFail();
              } catch (error) {
                assertErrorHexCode(
                  error,
                  getErrorCode("AccountNotInitialized")
                );
              }
            });
          });

          context("when the passed mint is valid", () => {
            context("when the signer is not the campaign creator", () => {
              it("should revert", async () => {
                try {
                  await clawback({
                    signer: eve.keys,
                  });

                  assertFail();
                } catch (error) {
                  assertErrorHexCode(error, getErrorCode("ConstraintAddress"));
                }
              });
            });

            context("when the signer is the campaign creator", () => {
              context(
                "when there are not enough tokens in the campaign ATA",
                () => {
                  it("should revert", async () => {
                    try {
                      await clawback({
                        amount: defaults.AGGREGATE_AMOUNT.add(new BN(1)),
                      });

                      assert.fail(
                        "Expected the tx to revert, but it succeeded."
                      );
                    } catch (error) {
                      assertErrorHexCode(error, "0x1");
                    }
                  });
                }
              );

              context(
                "when there are enough tokens in the campaign ATA",
                () => {
                  context("when the campaign is not in grace period", () => {
                    context("when the campaign has not expired", () => {
                      it("should revert", async () => {
                        // Claim the airdrop, trigerring the grace period
                        await claim();

                        // Time travel to when the grace period has ended
                        await timeTravelTo(defaults.TIME_AFTER_GRACE_PERIOD);

                        try {
                          await clawback();

                          assert.fail(
                            "Expected the tx to revert, but it succeeded."
                          );
                        } catch (error) {
                          assertErrorHexCode(
                            error,
                            getErrorCode("ClawbackNotAllowed")
                          );
                        }
                      });
                    });

                    context("when the campaign has expired", () => {
                      beforeEach(async () => {
                        // Claim the airdrop, trigerring the grace period
                        await claim();
                        // Time travel to when the campaign has expired
                        await timeTravelTo(defaults.EXPIRATION_TIME);
                      });

                      it("should clawback", async () => {
                        await clawback();
                      });
                    });
                  });

                  context("when the campaign is in grace period", () => {
                    beforeEach(async () => {
                      // Claim the airdrop, trigerring the grace period
                      await claim();
                    });

                    context(
                      "when the campaign creator no longer has the ATA",
                      () => {
                        it.skip("should clawback", async () => {
                          // TODO: Figure out how to delete the campaign creator's ATA
                          // from Bankrun
                        });
                      }
                    );

                    context(
                      "when the campaign creator still has the ATA",
                      () => {
                        context("given an SPL token", () => {
                          it("should clawback", async () => {
                            // Get the campaign creator's token balance before clawback
                            const campaignCreatorBalanceBefore =
                              await getCampaignCreatorSPLBalance();
                            // Get the campaign token balance before clawback
                            const campaignBalanceBefore =
                              await getCampaignSPLBalance();

                            // Perform the clawback
                            const clawbackAmount = defaults.CLAWBACK_AMOUNT;
                            await clawback({ amount: clawbackAmount });

                            // Get the campaign creator's token balance after clawback
                            const campaignCreatorBalanceAfter =
                              await getCampaignCreatorSPLBalance();
                            // Get the campaign token balance after clawback
                            const campaignBalanceAfter =
                              await getCampaignSPLBalance();

                            // Assert that the campaign token balance has decreased as expected
                            assert(
                              campaignBalanceAfter.eq(
                                campaignBalanceBefore.sub(clawbackAmount)
                              ),
                              "Campaign balance hasn't decreased as expected"
                            );
                            // Assert that the campaign creator's token balance has increased as expected
                            assert(
                              campaignCreatorBalanceAfter.eq(
                                campaignCreatorBalanceBefore.add(clawbackAmount)
                              ),
                              "Campaign creator's balance hasn't increased as expected"
                            );
                          });
                        });

                        context("given a Token2022 token", () => {
                          it("should clawback", async () => {
                            // Get the campaign creator's token balance before clawback
                            const campaignCreatorBalanceBefore =
                              await getCampaignCreatorToken2022Balance();
                            // Get the campaign token balance before clawback
                            const campaignBalanceBefore =
                              await getCampaignToken2022Balance();

                            // Perform the clawback
                            const clawbackAmount = defaults.CLAWBACK_AMOUNT;
                            await clawback({
                              campaign: campaignIds.token2022,
                              airdropTokenMint: dai,
                              airdropTokenProgram: TOKEN_2022_PROGRAM_ID,
                              amount: clawbackAmount,
                            });

                            // Get the campaign creator's token balance after clawback
                            const campaignCreatorBalanceAfter =
                              await getCampaignCreatorToken2022Balance();
                            // Get the campaign token balance after clawback
                            const campaignBalanceAfter =
                              await getCampaignToken2022Balance();

                            // Assert that the campaign token balance has decreased as expected
                            assert(
                              campaignBalanceAfter.eq(
                                campaignBalanceBefore.sub(clawbackAmount)
                              ),
                              "Campaign balance hasn't decreased as expected"
                            );
                            // Assert that the campaign creator's token balance has increased as expected
                            assert(
                              campaignCreatorBalanceAfter.eq(
                                campaignCreatorBalanceBefore.add(clawbackAmount)
                              ),
                              "Campaign creator's balance hasn't increased as expected"
                            );
                          });
                        });
                      }
                    );
                  });
                }
              );
            });
          });
        });
      });
    });
  });
});

async function getCampaignCreatorSPLBalance(): Promise<BN> {
  return await getATABalance(banksClient, campaignCreator.usdcATA);
}

async function getCampaignCreatorToken2022Balance(): Promise<BN> {
  return await getATABalance(banksClient, campaignCreator.daiATA);
}

async function getCampaignSPLBalance(): Promise<BN> {
  // Derive the ATA address of the campaign
  const campaignATA = deriveATAAddress(
    usdc,
    campaignIds.default,
    TOKEN_PROGRAM_ID
  );

  // Get the balance of the campaign ATA
  return await getATABalance(banksClient, campaignATA);
}

async function getCampaignToken2022Balance(): Promise<BN> {
  // Derive the ATA address of the campaign
  const campaignATA = deriveATAAddress(
    dai,
    campaignIds.token2022,
    TOKEN_2022_PROGRAM_ID
  );

  // Get the balance of the campaign ATA
  return await getATABalance(banksClient, campaignATA);
}
