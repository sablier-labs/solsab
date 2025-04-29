import { assertStreamData } from "../utils/assertions";
import {
  createWithDurations,
  defaultStreamData,
  fetchStreamData,
  setUp,
  timeTravelTo,
} from "../base";

import * as defaults from "../utils/defaults";

describe("createWithDurations", () => {
  beforeEach(async () => {
    await setUp();
    await timeTravelTo(defaults.START_TIME);
  });

  context("when cliff duration not zero", () => {
    it("it should create the stream", async () => {
      const streamId = await createWithDurations();

      const actualStreamData = await fetchStreamData(streamId);
      const expectedStreamData = await defaultStreamData({ id: streamId });
      assertStreamData(actualStreamData, expectedStreamData);
    });
  });

  context("when cliff duration zero", () => {
    it("it should create the stream", async () => {
      const streamId = await createWithDurations(defaults.ZERO_BN);

      const actualStreamData = await fetchStreamData(streamId);
      const expectedStreamData = await defaultStreamData({ id: streamId });
      expectedStreamData.amounts.cliffUnlock = defaults.ZERO_BN;
      expectedStreamData.timestamps.cliff = defaults.ZERO_BN;
      assertStreamData(actualStreamData, expectedStreamData);
    });
  });
});
