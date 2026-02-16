import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ERR_ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as ERR_CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeEach, describe, it } from "vitest";
import { BN_1 } from "../../../lib/constants";
import { sleepFor } from "../../../lib/helpers";
import { getATABalance } from "../../common/anchor-bankrun";
import { LockupTestContext } from "../context";
import { expectToThrow, postCancelAssertions } from "../utils/assertions";
import { Time, TranchedAmounts, TranchedTimes } from "../utils/defaults";

let ctx: LockupTestContext;

describe("cancelLt", () => {
  describe("when the program is not initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
    });

    it("should fail", async () => {
      await expectToThrow(ctx.cancel({ salt: BN_1 }), ERR_ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("given a null stream", () => {
      it("should fail", async () => {
        await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
        await expectToThrow(
          ctx.cancel({ salt: ctx.salts.nonExisting }),
          ERR_ACCOUNT_NOT_INITIALIZED,
        );
      });
    });

    describe("given a valid stream", () => {
      describe("given an invalid deposited token mint", () => {
        it("should fail", async () => {
          await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
          await expectToThrow(
            ctx.cancel({
              depositedTokenMint: ctx.randomToken,
              salt: ctx.salts.defaultLt,
            }),
            ERR_ACCOUNT_NOT_INITIALIZED,
          );
        });
      });

      describe("given a valid deposited token mint", () => {
        describe("given a cold stream", () => {
          describe("given DEPLETED status", () => {
            it("should fail", async () => {
              await ctx.timeTravelTo(TranchedTimes.END);
              await ctx.withdrawMax({ salt: ctx.salts.defaultLt });
              await expectToThrow(ctx.cancel({ salt: ctx.salts.defaultLt }), "StreamDepleted");
            });
          });

          describe("given CANCELED status", () => {
            it("should fail", async () => {
              await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
              await ctx.cancel({ salt: ctx.salts.defaultLt });
              await sleepFor(7);
              await expectToThrow(ctx.cancel({ salt: ctx.salts.defaultLt }), "StreamCanceled");
            });
          });

          describe("given SETTLED status", () => {
            it("should fail", async () => {
              await ctx.timeTravelTo(TranchedTimes.END);
              await expectToThrow(ctx.cancel({ salt: ctx.salts.defaultLt }), "StreamSettled");
            });
          });
        });

        describe("given a warm stream", () => {
          describe("when signer is not sender", () => {
            it("should fail", async () => {
              await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
              await expectToThrow(
                ctx.cancel({ salt: ctx.salts.defaultLt, signer: ctx.recipient.keys }),
                ERR_CONSTRAINT_ADDRESS,
              );
            });
          });

          describe("when signer is sender", () => {
            describe("given a non-cancelable stream", () => {
              it("should fail", async () => {
                await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
                await expectToThrow(
                  ctx.cancel({ salt: ctx.salts.nonCancelableLt }),
                  "StreamIsNotCancelable",
                );
              });
            });

            describe("given a cancelable stream", () => {
              describe("given PENDING (no tranches unlocked)", () => {
                it("should refund full deposit", async () => {
                  // Go back in time so that the stream is PENDING
                  await ctx.timeTravelTo(Time.GENESIS);

                  const beforeSenderBalance = await getATABalance(
                    ctx.banksClient,
                    ctx.sender.usdcATA,
                  );

                  // Cancel the stream
                  await ctx.cancel({ salt: ctx.salts.defaultLt });

                  // Assert the cancelation - full refund when nothing streamed
                  const expectedStream = ctx.defaultTranchedStream({
                    isCancelable: false,
                    isDepleted: true,
                    wasCanceled: true,
                  });
                  expectedStream.data.amounts.refunded = TranchedAmounts.DEPOSIT;

                  await postCancelAssertions(
                    ctx,
                    ctx.salts.defaultLt,
                    expectedStream,
                    beforeSenderBalance,
                  );
                });
              });

              describe("given STREAMING (some tranches unlocked)", () => {
                describe("given SPL token", () => {
                  it("should refund deposited - streamed", async () => {
                    // Time travel to after first tranche unlocks
                    await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);

                    const beforeSenderBalance = await getATABalance(
                      ctx.banksClient,
                      ctx.sender.usdcATA,
                    );

                    // Cancel the stream
                    await ctx.cancel({ salt: ctx.salts.defaultLt });

                    // At tranche 1, only tranche 1 amount is streamed
                    const expectedRefund = TranchedAmounts.DEPOSIT.sub(TranchedAmounts.TRANCHE_1);

                    const expectedStream = ctx.defaultTranchedStream({
                      isCancelable: false,
                      wasCanceled: true,
                    });
                    expectedStream.data.amounts.refunded = expectedRefund;

                    await postCancelAssertions(
                      ctx,
                      ctx.salts.defaultLt,
                      expectedStream,
                      beforeSenderBalance,
                    );
                  });
                });

                describe("given Token2022", () => {
                  it("should refund deposited - streamed", async () => {
                    // Create a Token2022 LT stream
                    const salt = await ctx.createWithTimestampsLtToken2022();

                    // Time travel to after first tranche unlocks
                    await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);

                    const beforeSenderBalance = await getATABalance(
                      ctx.banksClient,
                      ctx.sender.daiATA,
                    );

                    // Cancel the stream
                    await ctx.cancelToken2022(salt);

                    // At tranche 1, only tranche 1 amount is streamed
                    const expectedRefund = TranchedAmounts.DEPOSIT.sub(TranchedAmounts.TRANCHE_1);

                    const expectedStream = ctx.defaultTranchedStreamToken2022({
                      isCancelable: false,
                      salt,
                      wasCanceled: true,
                    });
                    expectedStream.data.amounts.refunded = expectedRefund;

                    await postCancelAssertions(ctx, salt, expectedStream, beforeSenderBalance);
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
