import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import type BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, ProgramId, ZERO } from "../../../lib/constants";
import { sleepFor } from "../../../lib/helpers";
import { createATAAndFund, deriveATAAddress, getATABalance, getATABalanceMint } from "../../common/anchor-bankrun";
import { assertAccountNotExists, assertEqualBn } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Amount, Time } from "../utils/defaults";
import { type Stream } from "../utils/types";

describe("cancel", () => {
  let ctx: LockupTestContext;

  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      // Set the time to 26% of the stream duration
      await ctx.timeTravelTo(Time.MID_26_PERCENT);
    });

    it("should revert", async () => {
      await expectToThrow(ctx.cancel({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
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
      it("should revert", async () => {
        await expectToThrow(ctx.cancel({ salt: ctx.salts.nonExisting }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("given a valid stream", () => {
      describe("given an invalid deposited token mint", () => {
        it("should revert", async () => {
          await expectToThrow(ctx.cancel({ depositedTokenMint: ctx.randomToken }), ACCOUNT_NOT_INITIALIZED);
        });
      });

      describe("given a valid deposited token mint", () => {
        describe("given cold stream", () => {
          describe("given DEPLETED status", () => {
            it("should revert", async () => {
              await ctx.timeTravelTo(Time.END);
              await ctx.withdrawMax();
              await expectToThrow(ctx.cancel(), "StreamDepleted");
            });
          });

          describe("given CANCELED status", () => {
            it("should revert", async () => {
              await ctx.cancel();
              await sleepFor(7);
              await expectToThrow(ctx.cancel(), "StreamCanceled");
            });
          });

          describe("given SETTLED status", () => {
            it("should revert", async () => {
              await ctx.timeTravelTo(Time.END);
              await expectToThrow(ctx.cancel(), "StreamSettled");
            });
          });
        });

        describe("given warm stream", () => {
          describe("when signer not sender", () => {
            it("should revert", async () => {
              await expectToThrow(ctx.cancel({ signer: ctx.recipient.keys }), CONSTRAINT_ADDRESS);
            });
          });

          describe("when signer sender", () => {
            describe("given non cancelable stream", () => {
              it("should revert", async () => {
                await expectToThrow(ctx.cancel({ salt: ctx.salts.nonCancelable }), "StreamIsNotCancelable");
              });
            });

            describe("given cancelable stream", () => {
              describe("when the sender does not have ATA", () => {
                it("should cancel the stream", async () => {
                  // Derive the sender's ATA for the random token
                  const senderATA = deriveATAAddress(ctx.randomToken, ctx.sender.keys.publicKey, ProgramId.TOKEN);

                  // Assert the sender's ATA doesn't exist
                  await assertAccountNotExists(ctx, senderATA, "Sender's ATA");

                  // Create ATA for & mint random token to the stream creator
                  await createATAAndFund(
                    ctx.banksClient,
                    ctx.defaultBankrunPayer,
                    ctx.randomToken,
                    Amount.DEPOSIT,
                    ProgramId.TOKEN,
                    ctx.sender.keys.publicKey,
                  );

                  // Create a stream with a random token
                  const salt = await ctx.createWithTimestamps({
                    creator: ctx.sender.keys,
                    depositTokenMint: ctx.randomToken,
                    depositTokenProgram: ProgramId.TOKEN,
                  });

                  // Cancel the stream
                  await ctx.cancel({
                    depositedTokenMint: ctx.randomToken,
                    depositedTokenProgram: ProgramId.TOKEN,
                    salt,
                  });

                  // Assert the cancelation
                  const expectedStream = ctx.defaultStream({
                    depositedTokenMint: ctx.randomToken,
                    isCancelable: false,
                    salt: salt,
                    tokenProgram: ProgramId.TOKEN,
                    wasCanceled: true,
                  });
                  expectedStream.data.amounts.refunded = Amount.REFUND;

                  // Assert the cancelation
                  await postCancelAssertions(ctx, salt, expectedStream, ZERO);
                });
              });

              describe("given PENDING status", () => {
                it("should cancel the stream", async () => {
                  // Go back in time so that the stream is PENDING
                  await ctx.timeTravelTo(Time.GENESIS);

                  const beforeSenderBalance = await getATABalance(ctx.banksClient, ctx.sender.usdcATA);

                  // Cancel the stream
                  await ctx.cancel();

                  // Assert the cancelation
                  const expectedStream = ctx.defaultStream({
                    isCancelable: false,
                    isDepleted: true,
                    wasCanceled: true,
                  });
                  expectedStream.data.amounts.refunded = Amount.DEPOSIT;

                  // Assert the cancelation
                  await postCancelAssertions(ctx, ctx.salts.default, expectedStream, beforeSenderBalance);
                });
              });

              describe("given STREAMING status", () => {
                describe("given token SPL standard", () => {
                  it("should cancel the stream", async () => {
                    const beforeSenderBalance = await getATABalance(ctx.banksClient, ctx.sender.usdcATA);

                    // Cancel the stream
                    await ctx.cancel();

                    const expectedStream = ctx.defaultStream({
                      isCancelable: false,
                      wasCanceled: true,
                    });
                    expectedStream.data.amounts.refunded = Amount.REFUND;

                    // Assert the cancelation
                    await postCancelAssertions(ctx, ctx.salts.default, expectedStream, beforeSenderBalance);
                  });
                });

                describe("given token 2022 standard", () => {
                  it("should cancel the stream", async () => {
                    // Create a stream with a Token2022 mint
                    const salt = await ctx.createWithTimestampsToken2022();

                    const beforeSenderBalance = await getATABalance(ctx.banksClient, ctx.sender.daiATA);

                    // Cancel the stream
                    await ctx.cancelToken2022(salt);

                    const expectedStream = ctx.defaultStreamToken2022({
                      isCancelable: false,
                      salt: salt,
                      wasCanceled: true,
                    });
                    expectedStream.data.amounts.refunded = Amount.REFUND;

                    // Assert the cancelation
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

async function postCancelAssertions(ctx: LockupTestContext, salt: BN, expectedStream: Stream, beforeSenderBalance: BN) {
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
  assertEqualBn(actualBalanceRefunded, expectedStream.data.amounts.refunded);

  // Assert the StreamData ATA balance
  const actualStreamDataBalance = await getATABalanceMint(
    ctx.banksClient,
    expectedStream.dataAddress,
    expectedStream.data.depositedTokenMint,
  );
  const expectedStreamDataBalance = expectedStream.data.amounts.deposited.sub(expectedStream.data.amounts.refunded);
  assertEqualBn(actualStreamDataBalance, expectedStreamDataBalance);
}
