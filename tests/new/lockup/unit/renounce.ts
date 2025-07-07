import { BN } from "@coral-xyz/anchor";
import {
  cancel,
  defaultStream,
  fetchStreamData,
  salts,
  renounce,
  setUp,
  withdrawMax,
} from "../base";
import { eve, timeTravelTo } from "../../common-base";
import {
  assertErrorHexCode,
  assertEqStreamDatas,
  assertFail,
} from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";

describe("renounce", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp(false);
    });

    it("should revert", async () => {
      try {
        await renounce({ salt: new BN(1) });
        assertFail();
      } catch (error) {
        assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
      }
    });
  });

  context("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    context("given a null stream", () => {
      it("should revert", async () => {
        try {
          await renounce({ salt: salts.nonExisting });
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });

    context("given a valid stream", () => {
      context("given cold stream", () => {
        context("given DEPLETED status", () => {
          it("should revert", async () => {
            await timeTravelTo(defaults.END_TIME);
            await withdrawMax();
            try {
              await renounce();
              assertFail();
            } catch (error) {
              assertErrorHexCode(
                error,
                getErrorCode("StreamAlreadyNonCancelable")
              );
            }
          });
        });

        context("given CANCELED status", () => {
          it("should revert", async () => {
            await cancel();
            try {
              await renounce();
              assertFail();
            } catch (error) {
              assertErrorHexCode(
                error,
                getErrorCode("StreamAlreadyNonCancelable")
              );
            }
          });
        });

        context("given SETTLED status", () => {
          it("should revert", async () => {
            await timeTravelTo(defaults.END_TIME);
            try {
              await renounce();
              assertFail();
            } catch (error) {
              assertErrorHexCode(
                error,
                getErrorCode("StreamAlreadyNonCancelable")
              );
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
            } catch (error) {
              assertErrorHexCode(error, getErrorCode("ConstraintAddress"));
            }
          });
        });

        context("when signer sender", () => {
          context("given non cancelable stream", () => {
            it("should revert", async () => {
              try {
                await renounce({ salt: salts.nonCancelable });
                assertFail();
              } catch (error) {
                assertErrorHexCode(
                  error,
                  getErrorCode("StreamAlreadyNonCancelable")
                );
              }
            });
          });

          context("given cancelable stream", () => {
            it("should make stream non cancelable", async () => {
              await renounce();

              const actualStreamData = await fetchStreamData();
              const expectedStreamData = defaultStream().data;
              expectedStreamData.isCancelable = false;

              assertEqStreamDatas(actualStreamData, expectedStreamData);
            });
          });
        });
      });
    });
  });
});
