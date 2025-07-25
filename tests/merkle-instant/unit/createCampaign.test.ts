import { beforeAll, beforeEach, describe, it } from "vitest";
import { createCampaign, defaultCampaignData, fetchCampaignData, setUp } from "../base";
import { assertEqCampaignData, expectToThrow } from "../utils/assertions";

describe("createCampaign", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({
        initProgram: false,
      });
    });

    it("should create the campaign", async () => {
      await testCreateCampaign();
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    describe("when the campaign already exists", () => {
      it("should revert", async () => {
        await expectToThrow(createCampaign(), 0x0);
      });
    });

    describe("when the campaign does not exist", () => {
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
  assertEqCampaignData(actualCampaignData, expectedCampaignData);
}
