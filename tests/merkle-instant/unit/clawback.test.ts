import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { ZERO } from "../../../lib/constants";
import { createATAAndFund, deriveATAAddress, getATABalanceMint } from "../../common/anchor-bankrun";
import { assertAccountExists, assertAccountNotExists, assertEqualBn } from "../../common/assertions";
import {
  banksClient,
  dai,
  defaultBankrunPayer,
  eve,
  randomToken,
  recipient,
  timeTravelTo,
  usdc,
} from "../../common/base";
import {
  campaignCreator,
  claim,
  clawback,
  createCampaign,
  defaultCampaign,
  defaultCampaignToken2022,
  setUp,
} from "../base";
import { expectToThrow } from "../utils/assertions";
import { Amount, Time } from "../utils/defaults";

describe("clawback", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({
        initProgram: false,
      });
    });

    it("should revert", async () => {
      // Passing a non-Campaign account since no Campaigns exist yet
      await expectToThrow(clawback({ campaign: new PublicKey(12345) }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    describe("when the passed campaign account is invalid", () => {
      it("should revert", async () => {
        await expectToThrow(clawback({ campaign: new PublicKey(12345) }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("when the passed campaign account is valid", () => {
      describe("when the passed mint is invalid", () => {
        it("should revert", async () => {
          await expectToThrow(
            clawback({
              airdropTokenMint: dai,
            }),
            ACCOUNT_NOT_INITIALIZED,
          );
        });
      });

      describe("when the passed mint is valid", () => {
        describe("when the signer is not the campaign creator", () => {
          it("should revert", async () => {
            await expectToThrow(
              clawback({
                signer: eve.keys,
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
              await claim();
            });

            describe("given grace period not passed", () => {
              it("should clawback", async () => {
                await testClawback();
              });
            });

            describe("given grace period passed", () => {
              beforeEach(async () => {
                // Time travel to the end of the grace period
                await timeTravelTo(Time.POST_GRACE_PERIOD);
              });

              describe("given campaign not expired", () => {
                it("should revert", async () => {
                  await expectToThrow(clawback(), "ClawbackNotAllowed");
                });
              });

              describe("given campaign expired", () => {
                beforeEach(async () => {
                  // Time travel to the end of the campaign
                  await timeTravelTo(Time.EXPIRATION);
                });

                describe("when campaign creator does not have ATA", () => {
                  it("should clawback", async () => {
                    await createATAAndFund(
                      banksClient,
                      defaultBankrunPayer,
                      randomToken,
                      Amount.AGGREGATE,
                      TOKEN_PROGRAM_ID,
                      recipient.keys.publicKey,
                    );

                    const campaign = await createCampaign({
                      airdropTokenMint: randomToken,
                      campaignFunder: recipient.keys,
                    });

                    const campaignCreatorAta = deriveATAAddress(
                      randomToken,
                      campaignCreator.keys.publicKey,
                      TOKEN_PROGRAM_ID,
                    );
                    await assertAccountNotExists(campaignCreatorAta, "Campaign Creator's ATA");

                    // Claim from the Campaign
                    await testClawback({
                      airdropTokenMint: randomToken,
                      campaign: campaign,
                      campaignCreatorAtaExists: false,
                    });

                    await assertAccountExists(campaignCreatorAta, "Campaign Creator's ATA");
                  });
                });

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
                      airdropTokenMint: dai,
                      airdropTokenProgram: TOKEN_2022_PROGRAM_ID,
                      campaign: defaultCampaignToken2022,
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
  campaign = defaultCampaign,
  airdropTokenMint = usdc,
  airdropTokenProgram = TOKEN_PROGRAM_ID,
  campaignCreatorAtaExists = true,
} = {}) {
  const campaignAtaBalanceBefore = await getATABalanceMint(banksClient, campaign, airdropTokenMint);
  const creatorAtaBalanceBefore = campaignCreatorAtaExists
    ? await getATABalanceMint(banksClient, campaignCreator.keys.publicKey, airdropTokenMint)
    : ZERO;

  await clawback({
    airdropTokenMint,
    airdropTokenProgram,
    amount: Amount.CLAWBACK,
    campaign,
  });

  const campaignAtaBalanceAfter = await getATABalanceMint(banksClient, campaign, airdropTokenMint);

  // Assert that the campaign token balance has decreased as expected
  assertEqualBn(campaignAtaBalanceBefore, campaignAtaBalanceAfter.add(Amount.CLAWBACK));

  const creatorAtaBalanceAfter = await getATABalanceMint(banksClient, campaignCreator.keys.publicKey, airdropTokenMint);

  // Assert that the campaign creator's token balance has increased as expected
  assertEqualBn(creatorAtaBalanceBefore, creatorAtaBalanceAfter.sub(Amount.CLAWBACK));
}
