import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ERR_ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as ERR_CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import type BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1 } from "../../../lib/constants";
import { sleepFor } from "../../../lib/helpers";
import { getATABalance, getATABalanceMint } from "../../common/anchor-bankrun";
import { assertEqBn } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { LinearAmounts, Time } from "../utils/defaults";
import type { Stream } from "../utils/types";

let ctx: LockupTestContext;

describe("cancelLl", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      // Set the time to 26% of the stream duration
      await ctx.timeTravelTo(Time.MID_26_PERCENT);
    });

    it("should fail", async () => {
      await expectToThrow(ctx.cancel({ salt: BN_1 }), ERR_ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
      // Set the time to 26% of the stream duration
      await ctx.timeTravelTo(Time.MID_26_PERCENT);
    });

    describe("given a null stream", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.cancel({ salt: ctx.salts.nonExisting }),
          ERR_ACCOUNT_NOT_INITIALIZED,
        );
      });
    });

    describe("given a valid stream", () => {
      describe("given an invalid deposited token mint", () => {
        it("should fail", async () => {
          await expectToThrow(
            ctx.cancel({ depositedTokenMint: ctx.randomToken }),
            ERR_ACCOUNT_NOT_INITIALIZED,
          );
        });
      });

      describe("given a valid deposited token mint", () => {
        describe("given a cold stream", () => {
          describe("given DEPLETED status", () => {
            it("should fail", async () => {
              await ctx.timeTravelTo(Time.END);
              await ctx.withdrawMax();
              await expectToThrow(ctx.cancel(), "StreamDepleted");
            });
          });

          describe("given CANCELED status", () => {
            it("should fail", async () => {
              await ctx.cancel();
              await sleepFor(7);
              await expectToThrow(ctx.cancel(), "StreamCanceled");
            });
          });

          describe("given SETTLED status", () => {
            it("should fail", async () => {
              await ctx.timeTravelTo(Time.END);
              await expectToThrow(ctx.cancel(), "StreamSettled");
            });
          });
        });

        describe("given a warm stream", () => {
          describe("when signer is not sender", () => {
            it("should fail", async () => {
              await expectToThrow(
                ctx.cancel({ signer: ctx.recipient.keys }),
                ERR_CONSTRAINT_ADDRESS,
              );
            });
          });

          describe("when signer is sender", () => {
            describe("given a non-cancelable stream", () => {
              it("should fail", async () => {
                await expectToThrow(
                  ctx.cancel({ salt: ctx.salts.nonCancelableLl }),
                  "StreamIsNotCancelable",
                );
              });
            });

            describe("given a cancelable stream", () => {
              describe("given PENDING status", () => {
                it("should cancel the stream", async () => {
                  // Go back in time so that the stream is PENDING
                  await ctx.timeTravelTo(Time.GENESIS);

                  const beforeSenderBalance = await getATABalance(
                    ctx.banksClient,
                    ctx.sender.usdcATA,
                  );

                  // Cancel the stream
                  await ctx.cancel();

                  // Assert the cancelation - full refund when nothing streamed
                  const expectedStream = ctx.defaultLinearStream({
                    isCancelable: false,
                    isDepleted: true,
                    wasCanceled: true,
                  });
                  expectedStream.data.amounts.refunded = LinearAmounts.DEPOSIT;

                  await postCancelAssertions(
                    ctx.salts.defaultLl,
                    expectedStream,
                    beforeSenderBalance,
                  );
                });
              });

              describe("given STREAMING status", () => {
                describe("given token SPL standard", () => {
                  it("should cancel the stream", async () => {
                    const beforeSenderBalance = await getATABalance(
                      ctx.banksClient,
                      ctx.sender.usdcATA,
                    );

                    // Cancel the stream
                    await ctx.cancel();

                    const expectedStream = ctx.defaultLinearStream({
                      isCancelable: false,
                      wasCanceled: true,
                    });
                    expectedStream.data.amounts.refunded = LinearAmounts.REFUND;

                    // Assert the cancelation
                    await postCancelAssertions(
                      ctx.salts.defaultLl,
                      expectedStream,
                      beforeSenderBalance,
                    );
                  });
                });

                describe("given token 2022 standard", () => {
                  it("should cancel the stream", async () => {
                    // Create a stream with a Token2022 mint
                    const salt = await ctx.createWithTimestampsLlToken2022();

                    const beforeSenderBalance = await getATABalance(
                      ctx.banksClient,
                      ctx.sender.daiATA,
                    );

                    // Cancel the stream
                    await ctx.cancelToken2022(salt);

                    const expectedStream = ctx.defaultLinearStreamToken2022({
                      isCancelable: false,
                      salt: salt,
                      wasCanceled: true,
                    });
                    expectedStream.data.amounts.refunded = LinearAmounts.REFUND;

                    // Assert the cancelation
                    await postCancelAssertions(salt, expectedStream, beforeSenderBalance);
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

async function postCancelAssertions(salt: BN, expectedStream: Stream, beforeSenderBalance: BN) {
  // Assert that the Stream state has been updated correctly
  const actualStreamData = await ctx.fetchStreamData(salt);
  assertEqStreamData(actualStreamData, expectedStream.data);

  // Assert the Sender's ATA balance
  const afterSenderBalance = await getATABalanceMint(
    ctx.banksClient,
    expectedStream.data.sender,
    expectedStream.data.depositedTokenMint,
  );

  const actualBalanceRefunded = afterSenderBalance.sub(beforeSenderBalance);
  assertEqBn(actualBalanceRefunded, expectedStream.data.amounts.refunded);

  // Assert the StreamData ATA balance
  const actualStreamDataBalance = await getATABalanceMint(
    ctx.banksClient,
    expectedStream.dataAddress,
    expectedStream.data.depositedTokenMint,
  );
  const expectedStreamDataBalance = expectedStream.data.amounts.deposited.sub(
    expectedStream.data.amounts.refunded,
  );
  assertEqBn(actualStreamDataBalance, expectedStreamDataBalance);
}
