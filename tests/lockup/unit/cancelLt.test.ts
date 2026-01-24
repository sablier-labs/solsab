import type { BN } from "@coral-xyz/anchor";
import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, ProgramId, ZERO } from "../../../lib/constants";
import { sleepFor } from "../../../lib/helpers";
import {
  createATAAndFund,
  deriveATAAddress,
  getATABalance,
  getATABalanceMint,
} from "../../common/anchor-bankrun";
import { assertAccountNotExists, assertEqBn } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time, TranchedAmount, TranchedTime } from "../utils/defaults";
import type { Stream } from "../utils/types";

let ctx: LockupTestContext;

describe("cancelLt", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      await ctx.timeTravelTo(TranchedTime.TRANCHE_1);
    });

    it("should fail", async () => {
      await expectToThrow(ctx.cancel({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("given a null stream", () => {
      it("should fail", async () => {
        await ctx.timeTravelTo(TranchedTime.TRANCHE_1);
        await expectToThrow(ctx.cancel({ salt: ctx.salts.nonExisting }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("given a valid stream", () => {
      describe("given an invalid deposited token mint", () => {
        it("should fail", async () => {
          await ctx.timeTravelTo(TranchedTime.TRANCHE_1);
          await expectToThrow(
            ctx.cancel({
              depositedTokenMint: ctx.randomToken,
              salt: ctx.salts.defaultLt,
            }),
            ACCOUNT_NOT_INITIALIZED,
          );
        });
      });

      describe("given a valid deposited token mint", () => {
        describe("when stream status is DEPLETED", () => {
          it("should fail", async () => {
            await ctx.timeTravelTo(TranchedTime.END);
            await ctx.withdrawMax({ salt: ctx.salts.defaultLt });
            await expectToThrow(ctx.cancel({ salt: ctx.salts.defaultLt }), "StreamDepleted");
          });
        });

        describe("when stream is not cancelable", () => {
          it("should fail", async () => {
            await ctx.timeTravelTo(TranchedTime.TRANCHE_1);
            await expectToThrow(
              ctx.cancel({ salt: ctx.salts.nonCancelableLt }),
              "StreamIsNotCancelable",
            );
          });
        });

        describe("when stream status is CANCELED", () => {
          it("should fail", async () => {
            await ctx.timeTravelTo(TranchedTime.TRANCHE_1);
            await ctx.cancel({ salt: ctx.salts.defaultLt });
            await sleepFor(7);
            await expectToThrow(ctx.cancel({ salt: ctx.salts.defaultLt }), "StreamCanceled");
          });
        });

        describe("when stream is cancelable and not depleted/canceled", () => {
          describe("when signer not sender", () => {
            it("should fail", async () => {
              await ctx.timeTravelTo(TranchedTime.TRANCHE_1);
              await expectToThrow(
                ctx.cancel({ salt: ctx.salts.defaultLt, signer: ctx.recipient.keys }),
                CONSTRAINT_ADDRESS,
              );
            });
          });

          describe("when signer sender", () => {
            describe("when the sender does not have ATA", () => {
              it("should cancel the stream and create ATA", async () => {
                // Derive the sender's ATA for the random token
                const senderATA = deriveATAAddress(
                  ctx.randomToken,
                  ctx.sender.keys.publicKey,
                  ProgramId.TOKEN,
                );

                // Assert the sender's ATA doesn't exist
                await assertAccountNotExists(ctx, senderATA, "Sender's ATA");

                // Create ATA for & mint random token to the stream funder
                await createATAAndFund(
                  ctx.banksClient,
                  ctx.defaultBankrunPayer,
                  ctx.randomToken,
                  TranchedAmount.DEPOSIT,
                  ProgramId.TOKEN,
                  ctx.sender.keys.publicKey,
                );

                // Create a tranched stream with a random token
                const salt = await ctx.createWithTimestampsLt({
                  depositTokenMint: ctx.randomToken,
                  depositTokenProgram: ProgramId.TOKEN,
                  funder: ctx.sender.keys,
                });

                // Time travel to STREAMING status
                await ctx.timeTravelTo(TranchedTime.TRANCHE_1);

                // Cancel the stream
                await ctx.cancel({
                  depositedTokenMint: ctx.randomToken,
                  depositedTokenProgram: ProgramId.TOKEN,
                  salt,
                });

                // Assert the cancelation
                const expectedStream = ctx.defaultTranchedStream({
                  depositedTokenMint: ctx.randomToken,
                  isCancelable: false,
                  salt,
                  wasCanceled: true,
                });
                const expectedRefund = TranchedAmount.DEPOSIT.sub(TranchedAmount.TRANCHE_1);
                expectedStream.data.amounts.refunded = expectedRefund;

                await postCancelAssertions(salt, expectedStream, ZERO);
              });
            });

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
                expectedStream.data.amounts.refunded = TranchedAmount.DEPOSIT;

                await postCancelAssertions(
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
                  await ctx.timeTravelTo(TranchedTime.TRANCHE_1);

                  const beforeSenderBalance = await getATABalance(
                    ctx.banksClient,
                    ctx.sender.usdcATA,
                  );

                  // Cancel the stream
                  await ctx.cancel({ salt: ctx.salts.defaultLt });

                  // At tranche 1, only tranche 1 amount is streamed
                  // Refund = deposit - tranche_1
                  const expectedRefund = TranchedAmount.DEPOSIT.sub(TranchedAmount.TRANCHE_1);

                  const expectedStream = ctx.defaultTranchedStream({
                    isCancelable: false,
                    wasCanceled: true,
                  });
                  expectedStream.data.amounts.refunded = expectedRefund;

                  await postCancelAssertions(
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
                  await ctx.timeTravelTo(TranchedTime.TRANCHE_1);

                  const beforeSenderBalance = await getATABalance(
                    ctx.banksClient,
                    ctx.sender.daiATA,
                  );

                  // Cancel the stream
                  await ctx.cancelToken2022(salt);

                  // At tranche 1, only tranche 1 amount is streamed
                  // Refund = deposit - tranche_1
                  const expectedRefund = TranchedAmount.DEPOSIT.sub(TranchedAmount.TRANCHE_1);

                  const expectedStream = ctx.defaultTranchedStreamToken2022({
                    isCancelable: false,
                    salt,
                    wasCanceled: true,
                  });
                  expectedStream.data.amounts.refunded = expectedRefund;

                  await postCancelAssertions(salt, expectedStream, beforeSenderBalance);
                });
              });
            });

            describe("given SETTLED (all tranches unlocked)", () => {
              it("should fail", async () => {
                await ctx.timeTravelTo(TranchedTime.END);
                await expectToThrow(ctx.cancel({ salt: ctx.salts.defaultLt }), "StreamSettled");
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
