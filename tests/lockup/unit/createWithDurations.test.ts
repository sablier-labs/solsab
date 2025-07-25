import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { ZERO } from "../../../lib/constants";
import { timeTravelTo } from "../../common/base";
import { createWithDurations, defaultStream, fetchStreamData, setUp } from "../base";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time } from "../utils/defaults";

describe("createWithDurations", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({ initProgram: false });
      await timeTravelTo(Time.START);
    });

    it("should revert", async () => {
      await expectToThrow(createWithDurations({ salt: ZERO }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
      await timeTravelTo(Time.START);
    });

    describe("when cliff duration not zero", () => {
      it("it should create the stream", async () => {
        const salt = await createWithDurations();

        const actualStreamData = await fetchStreamData(salt);
        const expectedStreamData = defaultStream({ salt: salt }).data;
        assertEqStreamData(actualStreamData, expectedStreamData);
      });
    });

    describe("when cliff duration zero", () => {
      it("it should create the stream", async () => {
        const salt = await createWithDurations({ cliffDuration: ZERO });

        const actualStreamData = await fetchStreamData(salt);
        const expectedStreamData = defaultStream({ salt: salt }).data;
        expectedStreamData.amounts.cliffUnlock = ZERO;
        expectedStreamData.timestamps.cliff = ZERO;
        assertEqStreamData(actualStreamData, expectedStreamData);
      });
    });
  });
});
