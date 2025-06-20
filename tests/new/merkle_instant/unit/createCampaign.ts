import {
  createCampaign,
  defaultCampaignData,
  fetchCampaignData,
  setUp,
} from "../base";

import {
  assertEqCampaignDatas,
  assertErrorHexCode,
  assertFail,
} from "../utils/assertions";

describe("createCampaign", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp({
        initProgram: false,
      });
    });

    it("should create the campaign", async () => {
      await testCreateCampaign();
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
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, "0x0");
        }
      });
    });

    context("when the campaign does exist", () => {
      it("should create the campaign", async () => {
        await testCreateCampaign();
      });
    });
  });
});

async function testCreateCampaign() {
  const name = "Test Campaign";
  const campaign = await createCampaign({ name: name });
  // Assert that the campaign was created successfully
  const expectedCampaignData = {
    ...defaultCampaignData(),
    name: name,
  };
  const actualCampaignData = await fetchCampaignData(campaign);
  assertEqCampaignDatas(actualCampaignData, expectedCampaignData);
}
