import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1 } from "../../../lib/constants";
import { eve, timeTravelTo } from "../../common/base";
import { cancel, defaultStream, fetchStreamData, renounce, salts, setUp, withdrawMax } from "../base";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time } from "../utils/defaults";

describe("renounce", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({ initProgram: false });
    });

    it("should revert", async () => {
      await expectToThrow(renounce({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    describe("given a null stream", () => {
      it("should revert", async () => {
        await expectToThrow(renounce({ salt: salts.nonExisting }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("given a valid stream", () => {
      describe("given cold stream", () => {
        describe("given DEPLETED status", () => {
          it("should revert", async () => {
            await timeTravelTo(Time.END);
            await withdrawMax();
            await expectToThrow(renounce(), "StreamAlreadyNonCancelable");
          });
        });

        describe("given CANCELED status", () => {
          it("should revert", async () => {
            await cancel();
            await expectToThrow(renounce(), "StreamAlreadyNonCancelable");
          });
        });

        describe("given SETTLED status", () => {
          it("should revert", async () => {
            await timeTravelTo(Time.END);
            await expectToThrow(renounce(), "StreamAlreadyNonCancelable");
          });
        });
      });

      describe("given warm stream", () => {
        describe("when signer not sender", () => {
          it("should revert", async () => {
            await expectToThrow(renounce({ signer: eve.keys }), CONSTRAINT_ADDRESS);
          });
        });

        describe("when signer sender", () => {
          describe("given non cancelable stream", () => {
            it("should revert", async () => {
              await expectToThrow(renounce({ salt: salts.nonCancelable }), "StreamAlreadyNonCancelable");
            });
          });

          describe("given cancelable stream", () => {
            it("should make stream non cancelable", async () => {
              await renounce();

              const actualStreamData = await fetchStreamData();
              const expectedStreamData = defaultStream().data;
              expectedStreamData.isCancelable = false;

              assertEqStreamData(actualStreamData, expectedStreamData);
            });
          });
        });
      });
    });
  });
});
