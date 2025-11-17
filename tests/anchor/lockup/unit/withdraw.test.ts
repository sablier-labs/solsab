import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_RAW as CONSTRAINT_RAW,
} from "@coral-xyz/anchor-errors";
import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, ProgramId, ZERO } from "../../../../lib/constants";
import type { StreamData } from "../../../../target/types/sablier_lockup_structs";
import { createATAAndFund, deriveATAAddress, getATABalance } from "../../common/anchor-bankrun";
import { assertAccountExists, assertAccountNotExists, assertEqBn, assertLteBn } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Amount, Time } from "../utils/defaults";

let ctx: LockupTestContext;

describe("withdraw", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      // Set the time to 26% of the stream duration
      await ctx.timeTravelTo(Time.MID_26_PERCENT);
    });

    it("should fail", async () => {
      await expectToThrow(ctx.withdraw({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
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
        await expectToThrow(ctx.withdraw({ salt: ctx.salts.nonExisting }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("given a valid stream", () => {
      describe("given an invalid deposited token mint", () => {
        it("should fail", async () => {
          await expectToThrow(ctx.withdraw({ depositedTokenMint: ctx.randomToken }), ACCOUNT_NOT_INITIALIZED);
        });
      });

      describe("given a valid deposited token mint", () => {
        describe("when stream status is DEPLETED", () => {
          it("should fail", async () => {
            await ctx.timeTravelTo(Time.END);
            await ctx.withdrawMax();
            await expectToThrow(ctx.withdraw(), "StreamDepleted");
          });
        });

        describe("when stream status is not DEPLETED", () => {
          describe("when zero withdraw amount", () => {
            it("should fail", async () => {
              await expectToThrow(
                ctx.withdraw({
                  withdrawAmount: ZERO,
                }),
                "WithdrawAmountZero",
              );
            });
          });

          describe("when non zero withdraw amount", () => {
            describe("when withdraw amount overdraws", () => {
              it("should fail", async () => {
                await expectToThrow(
                  ctx.withdraw({
                    withdrawAmount: Amount.WITHDRAW.add(BN_1),
                  }),
                  "Overdraw",
                );
              });
            });

            describe("when withdraw amount does not overdraw", () => {
              describe("when withdrawal address not recipient", () => {
                describe("when signer not recipient", () => {
                  it("should fail", async () => {
                    await expectToThrow(
                      ctx.withdraw({
                        signer: ctx.sender.keys,
                        withdrawalRecipient: ctx.sender.keys.publicKey,
                      }),
                      CONSTRAINT_RAW,
                    );
                  });
                });

                describe("when recipient doesn't have an ATA for the Stream's asset", () => {
                  it("should create the ATA", async () => {
                    // Set up the sender for the test
                    await createATAAndFund(
                      ctx.banksClient,
                      ctx.defaultBankrunPayer,
                      ctx.randomToken,
                      Amount.DEPOSIT,
                      ProgramId.TOKEN,
                      ctx.sender.keys.publicKey,
                    );

                    // Create a new stream with a random token
                    const salt = await ctx.createWithTimestampsLl({
                      depositAmount: Amount.DEPOSIT,
                      depositTokenMint: ctx.randomToken,
                    });

                    // Derive the recipient's ATA address
                    const recipientATA = deriveATAAddress(
                      ctx.randomToken,
                      ctx.recipient.keys.publicKey,
                      ProgramId.TOKEN,
                    );

                    // Assert that the recipient's ATA does not exist
                    await assertAccountNotExists(ctx, recipientATA, "Recipient's ATA");

                    // Perform the withdrawal
                    await ctx.withdraw({
                      depositedTokenMint: ctx.randomToken,
                      salt,
                    });

                    // Assert that the recipient's ATA was created
                    await assertAccountExists(ctx, recipientATA, "Recipient's ATA");
                  });
                });

                describe("when recipient has an ATA for the Stream's asset", () => {
                  describe("when signer recipient", () => {
                    it("should make the withdrawal", async () => {
                      // Get the Lamports balance of the Treasury before the withdrawal
                      const treasuryLamportsBefore = await ctx.getTreasuryLamports();

                      // Get the withdrawal recipient's token balance before the withdrawal
                      const withdrawalRecipientATABalanceBefore = await getATABalance(
                        ctx.banksClient,
                        ctx.sender.usdcATA,
                      );

                      const txSignerKeys = ctx.recipient.keys;
                      const txSignerLamportsBefore = await ctx.getLamportsOf(txSignerKeys.publicKey);
                      await ctx.withdraw({
                        signer: txSignerKeys,
                        withdrawalRecipient: ctx.sender.keys.publicKey,
                      });

                      const expectedStreamData = ctx.defaultStream().data;
                      expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;

                      await postWithdrawAssertions(
                        ctx.salts.default,
                        txSignerKeys.publicKey,
                        txSignerLamportsBefore,
                        treasuryLamportsBefore,
                        ctx.sender.usdcATA,
                        withdrawalRecipientATABalanceBefore,
                        expectedStreamData,
                      );
                    });
                  });
                });
              });

              describe("when withdrawal address recipient", () => {
                describe("when signer recipient", () => {
                  it("should make the withdrawal", async () => {
                    // Get the Lamports balance of the Treasury before the withdrawal
                    const treasuryLamportsBefore = await ctx.getTreasuryLamports();

                    // Get the withdrawal recipient's token balance before the withdrawal
                    const withdrawalRecipientATABalanceBefore = await getATABalance(
                      ctx.banksClient,
                      ctx.recipient.usdcATA,
                    );

                    const txSignerKeys = ctx.recipient.keys;
                    const txSignerLamportsBefore = await ctx.getLamportsOf(txSignerKeys.publicKey);
                    await ctx.withdraw({ signer: txSignerKeys });

                    const expectedStreamData = ctx.defaultStream().data;
                    expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;

                    await postWithdrawAssertions(
                      ctx.salts.default,
                      txSignerKeys.publicKey,
                      txSignerLamportsBefore,
                      treasuryLamportsBefore,
                      ctx.recipient.usdcATA,
                      withdrawalRecipientATABalanceBefore,
                      expectedStreamData,
                    );
                  });
                });

                describe("when signer not recipient", () => {
                  describe("when stream status is SETTLED", () => {
                    it("should make the withdrawal", async () => {
                      await ctx.timeTravelTo(Time.END);

                      // Get the Lamports balance of the Treasury before the withdrawal
                      const treasuryLamportsBefore = await ctx.getTreasuryLamports();

                      // Get the withdrawal recipient's token balance before the withdrawal
                      const withdrawalRecipientATABalanceBefore = await getATABalance(
                        ctx.banksClient,
                        ctx.recipient.usdcATA,
                      );

                      const txSignerKeys = ctx.sender.keys;
                      const txSignerLamportsBefore = await ctx.getLamportsOf(txSignerKeys.publicKey);
                      await ctx.withdraw({
                        signer: txSignerKeys,
                        withdrawAmount: Amount.DEPOSIT,
                      });

                      const expectedStreamData = ctx.defaultStream().data;
                      expectedStreamData.amounts.withdrawn = Amount.DEPOSIT;
                      expectedStreamData.isCancelable = false;
                      expectedStreamData.isDepleted = true;

                      await postWithdrawAssertions(
                        ctx.salts.default,
                        txSignerKeys.publicKey,
                        txSignerLamportsBefore,
                        treasuryLamportsBefore,
                        ctx.recipient.usdcATA,
                        withdrawalRecipientATABalanceBefore,
                        expectedStreamData,
                      );
                    });
                  });

                  describe("when stream status is not SETTLED", () => {
                    describe("when stream status is CANCELED", () => {
                      it("should make the withdrawal", async () => {
                        await ctx.cancel();

                        // Get the Lamports balance of the Treasury before the withdrawal
                        const treasuryLamportsBefore = await ctx.getTreasuryLamports();

                        // Get the withdrawal recipient's token balance before the withdrawal
                        const withdrawalRecipientATABalanceBefore = await getATABalance(
                          ctx.banksClient,
                          ctx.recipient.usdcATA,
                        );

                        const txSignerKeys = ctx.sender.keys;
                        const txSignerLamportsBefore = await ctx.getLamportsOf(txSignerKeys.publicKey);
                        await ctx.withdraw({ signer: txSignerKeys });
                        const expectedStreamData = ctx.defaultStream({
                          isCancelable: false,
                          isDepleted: true,
                          wasCanceled: true,
                        }).data;
                        expectedStreamData.amounts.refunded = Amount.REFUND;
                        expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;

                        await postWithdrawAssertions(
                          ctx.salts.default,
                          txSignerKeys.publicKey,
                          txSignerLamportsBefore,
                          treasuryLamportsBefore,
                          ctx.recipient.usdcATA,
                          withdrawalRecipientATABalanceBefore,
                          expectedStreamData,
                        );
                      });
                    });

                    describe("when stream status is STREAMING", () => {
                      describe("given token SPL standard", () => {
                        it("should make the withdrawal", async () => {
                          // Get the Lamports balance of the Treasury before the withdrawal
                          const treasuryLamportsBefore = await ctx.getTreasuryLamports();

                          // Get the withdrawal recipient's token balance before the withdrawal
                          const withdrawalRecipientATABalanceBefore = await getATABalance(
                            ctx.banksClient,
                            ctx.recipient.usdcATA,
                          );

                          const txSignerKeys = ctx.sender.keys;
                          const txSignerLamportsBefore = await ctx.getLamportsOf(txSignerKeys.publicKey);
                          await ctx.withdraw({ signer: txSignerKeys });
                          const expectedStreamData = ctx.defaultStream().data;
                          expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;
                          await postWithdrawAssertions(
                            ctx.salts.default,
                            txSignerKeys.publicKey,
                            txSignerLamportsBefore,
                            treasuryLamportsBefore,
                            ctx.recipient.usdcATA,
                            withdrawalRecipientATABalanceBefore,
                            expectedStreamData,
                          );
                        });
                      });

                      describe("given token 2022 standard", () => {
                        it("should make the withdrawal", async () => {
                          const salt = await ctx.createWithTimestampsLlToken2022();

                          // Get the Lamports balance of the Treasury before the withdrawal
                          const treasuryLamportsBefore = await ctx.getTreasuryLamports();

                          // Get the withdrawal recipient's token balance before the withdrawal
                          const withdrawalRecipientATABalanceBefore = await getATABalance(
                            ctx.banksClient,
                            ctx.recipient.daiATA,
                          );

                          const txSignerKeys = ctx.sender.keys;
                          const txSignerLamportsBefore = await ctx.getLamportsOf(txSignerKeys.publicKey);
                          await ctx.withdrawToken2022(salt, txSignerKeys);

                          const expectedStreamData = ctx.defaultStreamToken2022({
                            salt: salt,
                          }).data;
                          expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;
                          await postWithdrawAssertions(
                            salt,
                            txSignerKeys.publicKey,
                            txSignerLamportsBefore,
                            treasuryLamportsBefore,
                            ctx.recipient.daiATA,
                            withdrawalRecipientATABalanceBefore,
                            expectedStreamData,
                          );
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
    });
  });
});

async function postWithdrawAssertions(
  salt: BN,
  txSigner: PublicKey,
  txSignerLamportsBefore: BN,
  treasuryLamportsBefore: BN,
  withdrawalRecipientATA: PublicKey,
  withdrawalRecipientATABalanceBefore: BN,
  expectedStreamData: StreamData,
) {
  // Assert that the Stream state has been updated correctly
  const actualStreamData = await ctx.fetchStreamData(salt);
  assertEqStreamData(actualStreamData, expectedStreamData);

  const expectedFee = await ctx.withdrawalFeeInLamports();

  // Get the Lamports balance of the Treasury after the withdrawal
  const treasuryLamportsAfter = await ctx.getTreasuryLamports();

  // Assert that the tx signer lamports balance has decreased by, at least, the withdrawal fee amount.
  // We use `<=` because we don't know the gas cost in advance.
  const txSignerLamportsAfter = await ctx.getLamportsOf(txSigner);
  assertLteBn(txSignerLamportsAfter, txSignerLamportsBefore.sub(expectedFee));

  // Assert that the Treasury has been credited with the withdrawal fee.
  assertEqBn(treasuryLamportsAfter, treasuryLamportsBefore.add(expectedFee));

  // Get the withdrawal recipient's token balance
  const withdrawalRecipientTokenBalance = await getATABalance(ctx.banksClient, withdrawalRecipientATA);

  // Assert that the withdrawal recipient's token balance has been changed correctly
  const expectedWithdrawnAmount = expectedStreamData.amounts.withdrawn;
  assertEqBn(withdrawalRecipientTokenBalance, withdrawalRecipientATABalanceBefore.add(expectedWithdrawnAmount));

  // TODO: Assert that the StreamData ATA has been changed correctly
}
