import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ERR_ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as ERR_CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeEach, describe, it } from "vitest";
import { BN_1 } from "../../../lib/constants";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time } from "../utils/defaults";

let ctx: LockupTestContext;

describe("renounceLl", () => {
  describe("when the program is not initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.renounce({ salt: BN_1 }), ERR_ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("given a null stream", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.renounce({ salt: ctx.salts.nonExisting }),
          ERR_ACCOUNT_NOT_INITIALIZED,
        );
      });
    });

    describe("given a valid stream", () => {
      describe("given a cold stream", () => {
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

      describe("given a warm stream", () => {
        describe("when signer is not sender", () => {
          it("should fail", async () => {
            await expectToThrow(ctx.renounce({ signer: ctx.eve.keys }), ERR_CONSTRAINT_ADDRESS);
          });
        });

        describe("when signer is sender", () => {
          describe("given a non-cancelable stream", () => {
            it("should fail", async () => {
              await expectToThrow(
                ctx.renounce({ salt: ctx.salts.nonCancelableLl }),
                "StreamAlreadyNonCancelable",
              );
            });
          });

          describe("given a cancelable stream", () => {
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
