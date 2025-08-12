import { beforeAll, beforeEach, describe, it } from "vitest";
import { MerkleInstantTestContext } from "../context";
import { assertEqCampaignData, expectToThrow } from "../utils/assertions";

let ctx: MerkleInstantTestContext;

describe("createCampaign", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant({
        initProgram: false,
      });
    });

    it("should create the campaign", async () => {
      // Campaigns may be created prior to program initialization, but cannot be used until the initialization occurs.
      // See SECURITY.md for details on sablier_merkle_instant assumptions.
      await testCreateCampaign(ctx);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new MerkleInstantTestContext();
      await ctx.setUpMerkleInstant();
    });

    describe("when the campaign already exists", () => {
      it("should fail", async () => {
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
