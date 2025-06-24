import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

import { getATABalanceMint } from "../../anchor-bankrun-adapter";
import { banksClient, dai, eve, timeTravelTo, usdc } from "../../common-base";

import {
  campaignCreator,
  claim,
  clawback,
  defaultCampaign,
  defaultCampaignToken2022,
  setUp,
} from "../base";

import { assert, assertErrorHexCode, assertFail } from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";

describe("clawback", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp({
        initProgram: false,
      });
    });

    it("should revert", async () => {
      try {
        // Passing a non-Campaign account since no Campaigns exist yet
        await clawback({ campaign: new PublicKey(12345) });
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

    context("when the passed campaign account is invalid", () => {
      it("should revert", async () => {
        try {
          await clawback({ campaign: new PublicKey(12345) });
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
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
            assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
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
          context("when first claim not made", () => {
            it("should clawback", async () => {
              await testClawback();
            });
          });

          context("when first claim made", () => {
            beforeEach(async () => {
              await claim();
            });

            context("given grace period not passed", () => {
              it("should clawback", async () => {
                await testClawback();
              });
            });

            context("given grace period passed", () => {
              beforeEach(async () => {
                // Time travel to the end of the grace period
                await timeTravelTo(defaults.TIME_AFTER_GRACE_PERIOD);
              });

              context("given campaign not expired", () => {
                it("should revert", async () => {
                  try {
                    await clawback();
                    assertFail();
                  } catch (error) {
                    assertErrorHexCode(
                      error,
                      getErrorCode("ClawbackNotAllowed")
                    );
                  }
                });
              });

              context("given campaign expired", () => {
                beforeEach(async () => {
                  // Time travel to the end of the campaign
                  await timeTravelTo(defaults.EXPIRATION_TIME);
                });

                context("given token SPL standard", () => {
                  it("should clawback", async () => {
                    // Claim from the Campaign
                    await testClawback();
                  });
                });

                context("given token 2022 standard", () => {
                  it("should clawback", async () => {
                    // Test the claim.
                    await testClawback(
                      defaultCampaignToken2022,
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

async function testClawback(
  campaign = defaultCampaign,
  airdropTokenMint = usdc,
  airdropTokenProgram = TOKEN_PROGRAM_ID
) {
  const campaignAtaBalanceBefore = await getATABalanceMint(
    banksClient,
    campaign,
    airdropTokenMint
  );
  const creatorAtaBalanceBefore = await getATABalanceMint(
    banksClient,
    campaignCreator.keys.publicKey,
    airdropTokenMint
  );

  await clawback({
    campaign,
    amount: defaults.CLAWBACK_AMOUNT,
    airdropTokenMint,
    airdropTokenProgram,
  });

  const campaignAtaBalanceAfter = await getATABalanceMint(
    banksClient,
    campaign,
    airdropTokenMint
  );

  // Assert that the campaign token balance has decreased as expected
  assert(
    campaignAtaBalanceBefore.eq(
      campaignAtaBalanceAfter.add(defaults.CLAWBACK_AMOUNT)
    ),
    "Campaign ATA balance"
  );

  const creatorAtaBalanceAfter = await getATABalanceMint(
    banksClient,
    campaignCreator.keys.publicKey,
    airdropTokenMint
  );

  // Assert that the campaign creator's token balance has increased as expected
  assert(
    creatorAtaBalanceBefore.eq(
      creatorAtaBalanceAfter.sub(defaults.CLAWBACK_AMOUNT)
    ),
    "Campaign creator's ATA balance"
  );
}
