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
      /*
        NOTE: This test demonstrates that campaigns can be created even when the program
        is not initialized yet.

        Any campaign created before program initialization is unusable, as users are not able to claim from it
        (because the Claim Ix requires the Treasury account, which only exists after initialization).

        While this might seem like a security concern, it's, actually, acceptable, for the following reasons:

        1. In practice, we deploy and initialize the program simultaneously via scripts,
           making it extremely unlikely for anyone to create a campaign in the brief
           window between deployment and initialization.

        2. Even if someone manages to create a campaign during this window, it would
           only be unusable for a few moments/minutes until we complete the initialization.
           The said campaign would then become fully functional.

        3. Preventing this scenario would require complex program logic that isn't
           justified given the minimal and recoverable risk.

        Therefore, we accept this theoretical edge case in favor of simpler program implementation.
      */
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
