import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_RAW as CONSTRAINT_RAW,
} from "@coral-xyz/anchor-errors";
import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, ZERO } from "../../../lib/constants";
import type { StreamData } from "../../../target/types/sablier_lockup_structs";
import { getATABalance } from "../../common/anchor-bankrun";
import { assertEqBn, assertLteBn } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Time, TranchedAmounts, TranchedTimes } from "../utils/defaults";

let ctx: LockupTestContext;

describe("withdrawLt", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
      await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
    });

    it("should fail", async () => {
      await expectToThrow(ctx.withdraw({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
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
        await expectToThrow(ctx.withdraw({ salt: ctx.salts.nonExisting }), ACCOUNT_NOT_INITIALIZED);
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
            ACCOUNT_NOT_INITIALIZED,
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
              describe("when withdrawal address not recipient", () => {
                describe("when signer not recipient", () => {
                  it("should fail", async () => {
                    await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);
                    await expectToThrow(
                      ctx.withdraw({
                        salt: ctx.salts.defaultLt,
                        signer: ctx.sender.keys,
                        withdrawalRecipient: ctx.sender.keys.publicKey,
                      }),
                      CONSTRAINT_RAW,
                    );
                  });
                });
              });

              describe("when withdrawal address recipient", () => {
                describe("given PENDING status (before start)", () => {
                  it("should fail with Overdraw", async () => {
                    // Time travel to before the start time
                    await ctx.timeTravelTo(Time.START.subn(100));
                    await expectToThrow(
                      ctx.withdraw({
                        salt: ctx.salts.defaultLt,
                        withdrawAmount: BN_1,
                      }),
                      "Overdraw",
                    );
                  });
                });

                describe("given STREAMING status", () => {
                  describe("given before first tranche", () => {
                    it("should fail with Overdraw", async () => {
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

                  describe("given after first tranche", () => {
                    it("should withdraw", async () => {
                      await ctx.timeTravelTo(TranchedTimes.TRANCHE_1);

                      const treasuryLamportsBefore = await ctx.getTreasuryLamports();
                      const withdrawalRecipientATABalanceBefore = await getATABalance(
                        ctx.banksClient,
                        ctx.recipient.usdcATA,
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

                      const expectedStreamData = ctx.defaultTranchedStream().data;
                      expectedStreamData.amounts.withdrawn = TranchedAmounts.TRANCHE_1;

                      await postWithdrawAssertions(
                        ctx.salts.defaultLt,
                        txSignerKeys.publicKey,
                        txSignerLamportsBefore,
                        treasuryLamportsBefore,
                        ctx.recipient.usdcATA,
                        withdrawalRecipientATABalanceBefore,
                        expectedStreamData,
                      );
                    });
                  });
                });

                describe("given SETTLED status (all tranches passed)", () => {
                  it("should allow full withdrawal", async () => {
                    await ctx.timeTravelTo(TranchedTimes.END);

                    const treasuryLamportsBefore = await ctx.getTreasuryLamports();
                    const withdrawalRecipientATABalanceBefore = await getATABalance(
                      ctx.banksClient,
                      ctx.recipient.usdcATA,
                    );

                    const txSignerKeys = ctx.recipient.keys;
                    const txSignerLamportsBefore = await ctx.getLamportsOf(txSignerKeys.publicKey);

                    await ctx.withdraw({
                      salt: ctx.salts.defaultLt,
                      signer: txSignerKeys,
                      withdrawAmount: TranchedAmounts.DEPOSIT,
                    });

                    const expectedStreamData = ctx.defaultTranchedStream().data;
                    expectedStreamData.amounts.withdrawn = TranchedAmounts.DEPOSIT;
                    expectedStreamData.isCancelable = false;
                    expectedStreamData.isDepleted = true;

                    await postWithdrawAssertions(
                      ctx.salts.defaultLt,
                      txSignerKeys.publicKey,
                      txSignerLamportsBefore,
                      treasuryLamportsBefore,
                      ctx.recipient.usdcATA,
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
  const txSignerLamportsAfter = await ctx.getLamportsOf(txSigner);
  assertLteBn(txSignerLamportsAfter, txSignerLamportsBefore.sub(expectedFee));

  // Assert that the Treasury has been credited with the withdrawal fee.
  assertEqBn(treasuryLamportsAfter, treasuryLamportsBefore.add(expectedFee));

  // Get the withdrawal recipient's token balance
  const withdrawalRecipientTokenBalance = await getATABalance(
    ctx.banksClient,
    withdrawalRecipientATA,
  );

  // Assert that the withdrawal recipient's token balance has been changed correctly
  const expectedWithdrawnAmount = expectedStreamData.amounts.withdrawn;
  assertEqBn(
    withdrawalRecipientTokenBalance,
    withdrawalRecipientATABalanceBefore.add(expectedWithdrawnAmount),
  );
}
