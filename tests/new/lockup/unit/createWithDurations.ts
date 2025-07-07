import {
  createWithDurations,
  defaultStream,
  fetchStreamData,
  setUp,
} from "../base";
import { timeTravelTo } from "../../common-base";
import {
  assertEqStreamDatas,
  assertErrorContains,
  assertFail,
} from "../utils/assertions";
import * as defaults from "../utils/defaults";

describe("createWithDurations", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp(false);
      await timeTravelTo(defaults.START_TIME);
    });

    it("should revert", async () => {
      try {
        await createWithDurations();
        assertFail();
      } catch (error) {
        assertErrorContains(
          error,
          defaults.PROGRAM_NOT_INITIALIZED_ERR.CreateWithTimestamps
        );
      }
    });
  });

  context("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
      await timeTravelTo(defaults.START_TIME);
    });

    context("when cliff duration not zero", () => {
      it("it should create the stream", async () => {
        const salt = await createWithDurations();

        const actualStreamData = await fetchStreamData(salt);
        const expectedStreamData = defaultStream({ salt: salt }).data;
        assertEqStreamDatas(actualStreamData, expectedStreamData);
      });
    });

    context("when cliff duration zero", () => {
      it("it should create the stream", async () => {
        const salt = await createWithDurations(defaults.ZERO_BN);

        const actualStreamData = await fetchStreamData(salt);
        const expectedStreamData = defaultStream({ salt: salt }).data;
        expectedStreamData.amounts.cliffUnlock = defaults.ZERO_BN;
        expectedStreamData.timestamps.cliff = defaults.ZERO_BN;
        assertEqStreamDatas(actualStreamData, expectedStreamData);
      });
    });
  });
});
