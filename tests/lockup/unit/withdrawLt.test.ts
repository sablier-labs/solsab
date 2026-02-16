import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ERR_ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_RAW as ERR_CONSTRAINT_RAW,
} from "@coral-xyz/anchor-errors";
import { beforeEach, describe, it } from "vitest";
import { BN_1, ProgramId, ZERO } from "../../../lib/constants";
import { createATAAndFund, deriveATAAddress, getATABalance } from "../../common/anchor-bankrun";
import { assertAccountExists, assertAccountNotExists } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { expectToThrow, postWithdrawAssertions } from "../utils/assertions";
import { Time, TranchedAmounts, TranchedTimes } from "../utils/defaults";

let ctx: LockupTestContext;

describe("withdrawLt", () => {
  describe("when the program is not initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
    });

    it("should fail", async () => {
      await expectToThrow(ctx.withdraw({ salt: BN_1 }), ERR_ACCOUNT_NOT_INITIALIZED);
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
          ctx.withdraw({ salt: ctx.salts.nonExisting }),
          ERR_ACCOUNT_NOT_INITIALIZED,
        );
      });
    });

    describe("given a valid stream", () => {
      describe("given an invalid deposited token mint", () => {
        it("should fail", async () => {
          await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
          await expectToThrow(
            ctx.withdraw({
              depositedTokenMint: ctx.randomToken,
              salt: ctx.salts.defaultLt,
            }),
            ERR_ACCOUNT_NOT_INITIALIZED,
          );
        });
      });

      describe("given a valid deposited token mint", () => {
        describe("when stream status is DEPLETED", () => {
          it("should fail", async () => {
            await ctx.timeTravelTo(TranchedTimes.END);
            await ctx.withdrawMax({ salt: ctx.salts.defaultLt });
            await expectToThrow(ctx.withdraw({ salt: ctx.salts.defaultLt }), "StreamDepleted");
          });
        });

        describe("when stream status is not DEPLETED", () => {
          describe("when zero withdraw amount", () => {
            it("should fail", async () => {
              await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
              await expectToThrow(
                ctx.withdraw({
                  salt: ctx.salts.defaultLt,
                  withdrawAmount: ZERO,
                }),
                "WithdrawAmountZero",
              );
            });
          });

          describe("when non-zero withdraw amount", () => {
            describe("when withdraw amount overdraws", () => {
              it("should fail", async () => {
                await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
                // After tranche 1, only TranchedAmount.TRANCHE_1 is available
                await expectToThrow(
                  ctx.withdraw({
                    salt: ctx.salts.defaultLt,
                    withdrawAmount: TranchedAmounts.TRANCHE_1.add(BN_1),
                  }),
                  "Overdraw",
                );
              });
            });

            describe("when withdraw amount does not overdraw", () => {
              describe("when withdrawal address is not recipient", () => {
                describe("when signer is not recipient", () => {
                  it("should fail", async () => {
                    await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
                    await expectToThrow(
                      ctx.withdraw({
                        salt: ctx.salts.defaultLt,
                        signer: ctx.sender.keys,
                        withdrawalRecipient: ctx.sender.keys.publicKey,
                      }),
                      ERR_CONSTRAINT_RAW,
                    );
                  });
                });

                describe("when signer is recipient", () => {
                  describe("when recipient doesn't have an ATA for the stream's asset", () => {
                    it("should create the ATA", async () => {
                      await createATAAndFund(
                        ctx.banksClient,
                        ctx.defaultBankrunPayer,
                        ctx.randomToken,
                        TranchedAmounts.DEPOSIT,
                        ProgramId.SPL_TOKEN,
                        ctx.sender.keys.publicKey,
                      );

                      const salt = await ctx.createWithTimestampsLt({
                        depositTokenMint: ctx.randomToken,
                        depositTokenProgram: ProgramId.SPL_TOKEN,
                      });

                      await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);

                      const recipientATA = deriveATAAddress(
                        ctx.randomToken,
                        ctx.recipient.keys.publicKey,
                        ProgramId.SPL_TOKEN,
                      );

                      await assertAccountNotExists(ctx, recipientATA, "Recipient's ATA");

                      await ctx.withdraw({
                        depositedTokenMint: ctx.randomToken,
                        salt,
                        withdrawAmount: TranchedAmounts.TRANCHE_1,
                      });

                      await assertAccountExists(ctx, recipientATA, "Recipient's ATA");
                    });
                  });

                  describe("when recipient has an ATA for the stream's asset", () => {
                    it("should make the withdrawal", async () => {
                      await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);

                      const stream = ctx.defaultTranchedStream();
                      const treasuryLamportsBefore = await ctx.getTreasuryLamports();
                      const withdrawalRecipientATABalanceBefore = await getATABalance(
                        ctx.banksClient,
                        ctx.sender.usdcATA,
                      );
                      const streamDataAtaBalanceBefore = await getATABalance(
                        ctx.banksClient,
                        stream.dataAta,
                      );

                      const txSignerKeys = ctx.recipient.keys;
                      const txSignerLamportsBefore = await ctx.getLamportsOf(
                        txSignerKeys.publicKey,
                      );

                      await ctx.withdraw({
                        salt: ctx.salts.defaultLt,
                        signer: txSignerKeys,
                        withdrawAmount: TranchedAmounts.TRANCHE_1,
                        withdrawalRecipient: ctx.sender.keys.publicKey,
                      });

                      const expectedStreamData = stream.data;
                      expectedStreamData.amounts.withdrawn = TranchedAmounts.TRANCHE_1;

                      await postWithdrawAssertions(
                        ctx,
                        ctx.salts.defaultLt,
                        txSignerKeys.publicKey,
                        txSignerLamportsBefore,
                        treasuryLamportsBefore,
                        ctx.sender.usdcATA,
                        withdrawalRecipientATABalanceBefore,
                        expectedStreamData,
                        stream.dataAta,
                        streamDataAtaBalanceBefore,
                      );
                    });
                  });
                });
              });

              describe("when withdrawal address is recipient", () => {
                describe("when signer is recipient", () => {
                  describe("given STREAMING status", () => {
                    describe("given before first tranche", () => {
                      it("should fail", async () => {
                        // Time travel to after start but before first tranche
                        await ctx.timeTravelTo(Time.START.addn(100));
                        await expectToThrow(
                          ctx.withdraw({
                            salt: ctx.salts.defaultLt,
                            withdrawAmount: BN_1,
                          }),
                          "Overdraw",
                        );
                      });
                    });

                    describe("when after first tranche", () => {
                      describe("given SPL token", () => {
                        it("should withdraw", async () => {
                          await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);

                          const stream = ctx.defaultTranchedStream();
                          const treasuryLamportsBefore = await ctx.getTreasuryLamports();
                          const withdrawalRecipientATABalanceBefore = await getATABalance(
                            ctx.banksClient,
                            ctx.recipient.usdcATA,
                          );
                          const streamDataAtaBalanceBefore = await getATABalance(
                            ctx.banksClient,
                            stream.dataAta,
                          );

                          const txSignerKeys = ctx.recipient.keys;
                          const txSignerLamportsBefore = await ctx.getLamportsOf(
                            txSignerKeys.publicKey,
                          );

                          await ctx.withdraw({
                            salt: ctx.salts.defaultLt,
                            signer: txSignerKeys,
                            withdrawAmount: TranchedAmounts.TRANCHE_1,
                          });

                          const expectedStreamData = stream.data;
                          expectedStreamData.amounts.withdrawn = TranchedAmounts.TRANCHE_1;

                          await postWithdrawAssertions(
                            ctx,
                            ctx.salts.defaultLt,
                            txSignerKeys.publicKey,
                            txSignerLamportsBefore,
                            treasuryLamportsBefore,
                            ctx.recipient.usdcATA,
                            withdrawalRecipientATABalanceBefore,
                            expectedStreamData,
                            stream.dataAta,
                            streamDataAtaBalanceBefore,
                          );
                        });
                      });

                      describe("given Token2022", () => {
                        it("should withdraw", async () => {
                          const salt = await ctx.createWithTimestampsLtToken2022();
                          await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);

                          const stream = ctx.defaultTranchedStreamToken2022({ salt });
                          const treasuryLamportsBefore = await ctx.getTreasuryLamports();
                          const withdrawalRecipientATABalanceBefore = await getATABalance(
                            ctx.banksClient,
                            ctx.recipient.daiATA,
                          );
                          const streamDataAtaBalanceBefore = await getATABalance(
                            ctx.banksClient,
                            stream.dataAta,
                          );

                          const txSignerKeys = ctx.recipient.keys;
                          const txSignerLamportsBefore = await ctx.getLamportsOf(
                            txSignerKeys.publicKey,
                          );

                          await ctx.withdraw({
                            depositedTokenMint: ctx.dai,
                            depositedTokenProgram: ProgramId.TOKEN_2022,
                            salt,
                            signer: txSignerKeys,
                            withdrawAmount: TranchedAmounts.TRANCHE_1,
                          });

                          const expectedStreamData = stream.data;
                          expectedStreamData.amounts.withdrawn = TranchedAmounts.TRANCHE_1;

                          await postWithdrawAssertions(
                            ctx,
                            salt,
                            txSignerKeys.publicKey,
                            txSignerLamportsBefore,
                            treasuryLamportsBefore,
                            ctx.recipient.daiATA,
                            withdrawalRecipientATABalanceBefore,
                            expectedStreamData,
                            stream.dataAta,
                            streamDataAtaBalanceBefore,
                          );
                        });
                      });
                    });
                  });

                  describe("given SETTLED status", () => {
                    it("should allow full withdrawal", async () => {
                      await ctx.timeTravelTo(TranchedTimes.END);

                      const stream = ctx.defaultTranchedStream();
                      const treasuryLamportsBefore = await ctx.getTreasuryLamports();
                      const withdrawalRecipientATABalanceBefore = await getATABalance(
                        ctx.banksClient,
                        ctx.recipient.usdcATA,
                      );
                      const streamDataAtaBalanceBefore = await getATABalance(
                        ctx.banksClient,
                        stream.dataAta,
                      );

                      const txSignerKeys = ctx.recipient.keys;
                      const txSignerLamportsBefore = await ctx.getLamportsOf(
                        txSignerKeys.publicKey,
                      );

                      await ctx.withdraw({
                        salt: ctx.salts.defaultLt,
                        signer: txSignerKeys,
                        withdrawAmount: TranchedAmounts.DEPOSIT,
                      });

                      const expectedStreamData = stream.data;
                      expectedStreamData.amounts.withdrawn = TranchedAmounts.DEPOSIT;
                      expectedStreamData.isCancelable = false;
                      expectedStreamData.isDepleted = true;

                      await postWithdrawAssertions(
                        ctx,
                        ctx.salts.defaultLt,
                        txSignerKeys.publicKey,
                        txSignerLamportsBefore,
                        treasuryLamportsBefore,
                        ctx.recipient.usdcATA,
                        withdrawalRecipientATABalanceBefore,
                        expectedStreamData,
                        stream.dataAta,
                        streamDataAtaBalanceBefore,
                      );
                    });
                  });
                });

                describe("when signer is not recipient", () => {
                  describe("when stream status is SETTLED", () => {
                    it("should make the withdrawal", async () => {
                      await ctx.timeTravelTo(TranchedTimes.END);

                      const stream = ctx.defaultTranchedStream();
                      const treasuryLamportsBefore = await ctx.getTreasuryLamports();
                      const withdrawalRecipientATABalanceBefore = await getATABalance(
                        ctx.banksClient,
                        ctx.recipient.usdcATA,
                      );
                      const streamDataAtaBalanceBefore = await getATABalance(
                        ctx.banksClient,
                        stream.dataAta,
                      );

                      const txSignerKeys = ctx.sender.keys;
                      const txSignerLamportsBefore = await ctx.getLamportsOf(
                        txSignerKeys.publicKey,
                      );

                      await ctx.withdraw({
                        salt: ctx.salts.defaultLt,
                        signer: txSignerKeys,
                        withdrawAmount: TranchedAmounts.DEPOSIT,
                      });

                      const expectedStreamData = stream.data;
                      expectedStreamData.amounts.withdrawn = TranchedAmounts.DEPOSIT;
                      expectedStreamData.isCancelable = false;
                      expectedStreamData.isDepleted = true;

                      await postWithdrawAssertions(
                        ctx,
                        ctx.salts.defaultLt,
                        txSignerKeys.publicKey,
                        txSignerLamportsBefore,
                        treasuryLamportsBefore,
                        ctx.recipient.usdcATA,
                        withdrawalRecipientATABalanceBefore,
                        expectedStreamData,
                        stream.dataAta,
                        streamDataAtaBalanceBefore,
                      );
                    });
                  });

                  describe("when stream status is not SETTLED", () => {
                    describe("when stream status is CANCELED", () => {
                      it("should make the withdrawal", async () => {
                        await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
                        await ctx.cancel({ salt: ctx.salts.defaultLt });

                        const expectedRefund = TranchedAmounts.DEPOSIT.sub(
                          TranchedAmounts.TRANCHE_1,
                        );

                        const stream = ctx.defaultTranchedStream({
                          isCancelable: false,
                          isDepleted: true,
                          wasCanceled: true,
                        });
                        const treasuryLamportsBefore = await ctx.getTreasuryLamports();
                        const withdrawalRecipientATABalanceBefore = await getATABalance(
                          ctx.banksClient,
                          ctx.recipient.usdcATA,
                        );
                        const streamDataAtaBalanceBefore = await getATABalance(
                          ctx.banksClient,
                          stream.dataAta,
                        );

                        const txSignerKeys = ctx.sender.keys;
                        const txSignerLamportsBefore = await ctx.getLamportsOf(
                          txSignerKeys.publicKey,
                        );

                        await ctx.withdraw({
                          salt: ctx.salts.defaultLt,
                          signer: txSignerKeys,
                          withdrawAmount: TranchedAmounts.TRANCHE_1,
                        });

                        const expectedStreamData = stream.data;
                        expectedStreamData.amounts.refunded = expectedRefund;
                        expectedStreamData.amounts.withdrawn = TranchedAmounts.TRANCHE_1;

                        await postWithdrawAssertions(
                          ctx,
                          ctx.salts.defaultLt,
                          txSignerKeys.publicKey,
                          txSignerLamportsBefore,
                          treasuryLamportsBefore,
                          ctx.recipient.usdcATA,
                          withdrawalRecipientATABalanceBefore,
                          expectedStreamData,
                          stream.dataAta,
                          streamDataAtaBalanceBefore,
                        );
                      });
                    });

                    describe("when stream status is STREAMING", () => {
                      describe("given SPL token", () => {
                        it("should make the withdrawal", async () => {
                          await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);

                          const stream = ctx.defaultTranchedStream();
                          const treasuryLamportsBefore = await ctx.getTreasuryLamports();
                          const withdrawalRecipientATABalanceBefore = await getATABalance(
                            ctx.banksClient,
                            ctx.recipient.usdcATA,
                          );
                          const streamDataAtaBalanceBefore = await getATABalance(
                            ctx.banksClient,
                            stream.dataAta,
                          );

                          const txSignerKeys = ctx.sender.keys;
                          const txSignerLamportsBefore = await ctx.getLamportsOf(
                            txSignerKeys.publicKey,
                          );

                          await ctx.withdraw({
                            salt: ctx.salts.defaultLt,
                            signer: txSignerKeys,
                            withdrawAmount: TranchedAmounts.TRANCHE_1,
                          });

                          const expectedStreamData = stream.data;
                          expectedStreamData.amounts.withdrawn = TranchedAmounts.TRANCHE_1;

                          await postWithdrawAssertions(
                            ctx,
                            ctx.salts.defaultLt,
                            txSignerKeys.publicKey,
                            txSignerLamportsBefore,
                            treasuryLamportsBefore,
                            ctx.recipient.usdcATA,
                            withdrawalRecipientATABalanceBefore,
                            expectedStreamData,
                            stream.dataAta,
                            streamDataAtaBalanceBefore,
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
