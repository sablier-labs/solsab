import { beforeAll, beforeEach, describe, it } from "vitest";
import { MerkleInstantTestContext } from "../context";
import { assertEqCampaignData, expectToThrow } from "../utils/assertions";

describe("createCampaign", () => {
  let ctx: MerkleInstantTestContext;

  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant({
        initProgram: false,
      });
    });

    it("should create the campaign", async () => {
      await testCreateCampaign(ctx);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant();
    });

    describe("when the campaign already exists", () => {
      it("should revert", async () => {
        await expectToThrow(ctx.createCampaign(), 0x0);
      });
    });

    describe("when the campaign does not exist", () => {
      it("should create the campaign", async () => {
        await testCreateCampaign(ctx);
      });
    });
  });
});

async function testCreateCampaign(ctx: MerkleInstantTestContext) {
  const name = "Test Campaign";
  const campaign = await ctx.createCampaign({ name: name });
  // Assert that the campaign was created successfully
  const expectedCampaignData = {
    ...ctx.defaultCampaignData(),
    name: name,
  };
  const actualCampaignData = await ctx.fetchCampaignData(campaign);
  assertEqCampaignData(actualCampaignData, expectedCampaignData);
}
