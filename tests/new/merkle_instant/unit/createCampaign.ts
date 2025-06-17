import { PublicKey } from "@solana/web3.js";

import {
  campaignCreator,
  createCampaign,
  createCampaignToken2022,
  defaultCampaignData,
  fetchCampaignData,
  randomTokenToken2022,
  setUp,
  TOKEN_2022_PROGRAM_ID,
  createATAAndMintTo,
} from "../base";
import * as defaults from "../utils/defaults";
import {
  assertEqCampaignDatas,
  assertErrorHexCode,
  assertErrorContains,
  assertFail,
} from "../utils/assertions";

describe("createCampaign", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp({
        initProgram: false,
      });
    });

    it.skip("should revert", async () => {
      try {
        await createCampaign();
        assertFail();
      } catch (error) {
        assertErrorContains(error, "");
      }
    });
  });

  context("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    context("when the campaign already exists", () => {
      it("should revert", async () => {
        try {
          await createCampaign();

          assert.fail("Expected the tx to revert, but it succeeded.");
        } catch (error) {
          assertErrorHexCode(error, "0x0");
        }
      });
    });

    context("when the campaign does not yet exist", () => {
      context("given an SPL token", () => {
        it("should create the campaign", async () => {
          const campaignId = await createTestCampaign();
          // Assert that the campaign was created successfully
          const expectedCampaignData = {
            ...defaultCampaignData(),
            name: "Test Campaign",
          };
          const actualCampaignData = await fetchCampaignData(campaignId);
          assertEqCampaignDatas(actualCampaignData, expectedCampaignData);
        });
      });

      context("when the campaign already exists", () => {
        it("should revert", async () => {
          try {
            await createCampaign();
            assertFail();
          } catch (error) {
            assertErrorHexCode(error, "0x0");
          }
        });

          // Assert that the campaign was created successfully
          const expectedCampaignData = {
            ...defaultCampaignData(),
            airdropTokenMint: randomTokenToken2022,
            airdropTokenProgram: TOKEN_2022_PROGRAM_ID,
          };
          const actualCampaignData = await fetchCampaignData(campaignId);
          assertEqCampaignDatas(actualCampaignData, expectedCampaignData);
        });
      });
    });
  });
});

async function createTestCampaign(): Promise<PublicKey> {
  return await createCampaign({ name: "Test Campaign" });
}
