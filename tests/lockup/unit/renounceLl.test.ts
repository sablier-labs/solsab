import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1 } from "../../../lib/constants";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time } from "../utils/defaults";

let ctx: LockupTestContext;

describe("renounce", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.renounce({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("given a null stream", () => {
      it("should fail", async () => {
        await expectToThrow(ctx.renounce({ salt: ctx.salts.nonExisting }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("given a valid stream", () => {
      describe("given cold stream", () => {
        describe("given DEPLETED status", () => {
          it("should fail", async () => {
            await ctx.timeTravelTo(Time.END);
            await ctx.withdrawMax();
            await expectToThrow(ctx.renounce(), "StreamAlreadyNonCancelable");
          });
        });

        describe("given CANCELED status", () => {
          it("should fail", async () => {
            await ctx.cancel();
            await expectToThrow(ctx.renounce(), "StreamAlreadyNonCancelable");
          });
        });

        describe("given SETTLED status", () => {
          it("should fail", async () => {
            await ctx.timeTravelTo(Time.END);
            await expectToThrow(ctx.renounce(), "StreamAlreadyNonCancelable");
          });
        });
      });

      describe("given warm stream", () => {
        describe("when signer not sender", () => {
          it("should fail", async () => {
            await expectToThrow(ctx.renounce({ signer: ctx.eve.keys }), CONSTRAINT_ADDRESS);
          });
        });

        describe("when signer sender", () => {
          describe("given non cancelable stream", () => {
            it("should fail", async () => {
              await expectToThrow(
                ctx.renounce({ salt: ctx.salts.nonCancelableLl }),
                "StreamAlreadyNonCancelable",
              );
            });
          });

          describe("given cancelable stream", () => {
            it("should make stream non cancelable", async () => {
              await ctx.renounce();

              const actualStreamData = await ctx.fetchStreamData();
              const expectedStreamData = ctx.defaultLinearStream().data;
              expectedStreamData.isCancelable = false;

              assertEqStreamData(actualStreamData, expectedStreamData);
            });
          });
        });
      });
    });
  });
});
