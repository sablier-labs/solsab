import {
  cancel,
  defaultStreamData,
  eve,
  fetchStreamData,
  ids,
  renounce,
  setUp,
  timeTravelTo,
  withdrawMax,
} from "../base";
import { assertError, assertFail, assertStreamData } from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";

describe("renounce", () => {
  beforeEach(async () => {
    await setUp();
  });

  context("given null", () => {
    it("should revert", async () => {
      try {
        await renounce({ streamId: ids.nullStream });
      } catch (error) {
        assertError(error, "0xbc4");
      }
    });
  });

  context("given not null", () => {
    context("given cold stream", () => {
      context("given DEPLETED status", () => {
        it("should revert", async () => {
          await timeTravelTo(defaults.END_TIME);
          await withdrawMax();
          try {
            await renounce();
          } catch (error) {
            assertError(error, getErrorCode("StreamAlreadyNonCancelable"));
          }
        });
      });

      context("given CANCELED status", () => {
        it("should revert", async () => {
          await cancel();
          try {
            await renounce();
          } catch (error) {
            assertError(error, getErrorCode("StreamAlreadyNonCancelable"));
          }
        });
      });

      context("given SETTLED status", () => {
        it("should revert", async () => {
          await timeTravelTo(defaults.END_TIME);
          try {
            await renounce();
          } catch (error) {
            assertError(error, getErrorCode("StreamAlreadyNonCancelable"));
          }
        });
      });
    });

    context("given warm stream", () => {
      context("when signer not sender", () => {
        it("should revert", async () => {
          try {
            await renounce({ signer: eve.keys });
            assertFail();
          } catch (error) {}
        });
      });

      context("when signer sender", () => {
        context("given non cancelable stream", () => {
          it("should revert", async () => {
            try {
              await renounce({ streamId: ids.notCancelableStream });
            } catch (error) {
              assertError(error, getErrorCode("StreamAlreadyNonCancelable"));
            }
          });
        });

        context("given cancelable stream", () => {
          it("should make stream non cancelable", async () => {
            await renounce();

            const actualStreamData = await fetchStreamData();
            const expectedStreamData = await defaultStreamData();
            expectedStreamData.isCancelable = false;

            assertStreamData(actualStreamData, expectedStreamData);
          });
        });
      });
    });
  });
});
