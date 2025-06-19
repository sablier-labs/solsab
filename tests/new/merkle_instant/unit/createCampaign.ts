import {
  createCampaign,
  defaultCampaignData,
  fetchCampaignData,
  setUp,
} from "../base";
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
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, "0x0");
        }
      });
    });

    context("when the campaign does not yet exist", () => {
      context("given an SPL token", () => {
        it("should create the campaign", async () => {
          const campaign = await createCampaign();
          // Assert that the campaign was created successfully
          const expectedCampaignData = {
            ...defaultCampaignData(),
            name: "Test Campaign",
          };
          const actualCampaignData = await fetchCampaignData(campaign);
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

        context("when the campaign does not yet exist", () => {
          it("should create the campaign", async () => {
            const campaign = await createCampaign({
              name: "Test Campaign",
            });
            // Assert that the campaign was created successfully
            const expectedCampaignData = {
              ...defaultCampaignData(),
              name: "Test Campaign",
            };
            const actualCampaignData = await fetchCampaignData(campaign);
            assertEqCampaignDatas(actualCampaignData, expectedCampaignData);
          });
        });
      });
    });
  });
});
