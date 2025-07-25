import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_RAW as CONSTRAINT_RAW,
} from "@coral-xyz/anchor-errors";
import { type PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, ZERO } from "../../../lib/constants";
import { createATAAndFund } from "../../common/anchor-bankrun";
import {
  assertAccountExists,
  assertAccountNotExists,
  assertEqualBalanceSOL,
  assertEqualBn,
} from "../../common/assertions";
import { banksClient, defaultBankrunPayer, randomToken, recipient, timeTravelTo } from "../../common/base";
import {
  cancel,
  createWithTimestamps,
  createWithTimestampsToken2022,
  defaultStream,
  defaultStreamToken2022,
  deriveATAAddress,
  fetchStreamData,
  getATABalance,
  getTreasuryLamports,
  salts,
  sender,
  setUp,
  withdraw,
  withdrawMax,
  withdrawToken2022,
} from "../base";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Amount, ProgramId, Time } from "../utils/defaults";
import { type StreamData } from "../utils/types";

describe("withdraw", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({ initProgram: false });
      // Set the time to 26% of the stream duration
      await timeTravelTo(Time.MID_26_PERCENT);
    });

    it("should revert", async () => {
      await expectToThrow(withdraw({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
      // Set the time to 26% of the stream duration
      await timeTravelTo(Time.MID_26_PERCENT);
    });

    describe("given a null stream", () => {
      it("should revert", async () => {
        await expectToThrow(withdraw({ salt: salts.nonExisting }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("given a valid stream", () => {
      describe("given an invalid deposited token mint", () => {
        it("should revert", async () => {
          await expectToThrow(withdraw({ depositedTokenMint: randomToken }), ACCOUNT_NOT_INITIALIZED);
        });
      });

      describe("given a valid deposited token mint", () => {
        describe("when stream status is DEPLETED", () => {
          it("should revert", async () => {
            await timeTravelTo(Time.END);
            await withdrawMax();
            await expectToThrow(withdraw(), "StreamDepleted");
          });
        });

        describe("when stream status is not DEPLETED", () => {
          describe("when zero withdraw amount", () => {
            it("should revert", async () => {
              await expectToThrow(
                withdraw({
                  withdrawAmount: ZERO,
                }),
                "WithdrawAmountZero",
              );
            });
          });

          describe("when non zero withdraw amount", () => {
            describe("when withdraw amount overdraws", () => {
              it("should revert", async () => {
                await expectToThrow(
                  withdraw({
                    withdrawAmount: Amount.WITHDRAW.add(BN_1),
                  }),
                  "Overdraw",
                );
              });
            });

            describe("when withdraw amount does not overdraw", () => {
              describe("when withdrawal address not recipient", () => {
                describe("when signer not recipient", () => {
                  it("should revert", async () => {
                    await expectToThrow(
                      withdraw({
                        signer: sender.keys,
                        withdrawalRecipient: sender.keys.publicKey,
                      }),
                      CONSTRAINT_RAW,
                    );
                  });
                });

                describe("when recipient doesn't have an ATA for the Stream's asset", () => {
                  it("should create the ATA", async () => {
                    // Set up the sender for the test
                    await createATAAndFund(
                      banksClient,
                      defaultBankrunPayer,
                      randomToken,
                      Amount.DEPOSIT,
                      ProgramId.TOKEN,
                      sender.keys.publicKey,
                    );

                    // Create a new stream with a random token
                    const salt = await createWithTimestamps({
                      depositAmount: Amount.DEPOSIT,
                      depositTokenMint: randomToken,
                    });

                    // Derive the recipient's ATA address
                    const recipientATA = deriveATAAddress(randomToken, recipient.keys.publicKey, ProgramId.TOKEN);

                    // Assert that the recipient's ATA does not exist
                    await assertAccountNotExists(recipientATA, "Recipient's ATA");

                    // Perform the withdrawal
                    await withdraw({
                      depositedTokenMint: randomToken,
                      salt,
                    });

                    // Assert that the recipient's ATA was created
                    await assertAccountExists(recipientATA, "Recipient's ATA");
                  });
                });

                describe("when recipient has an ATA for the Stream's asset", () => {
                  describe("when signer recipient", () => {
                    it("should make the withdrawal", async () => {
                      // Get the Lamports balance of the Treasury before the withdrawal
                      const treasuryLamportsBefore = await getTreasuryLamports();

                      // Get the withdrawal recipient's token balance before the withdrawal
                      const withdrawalRecipientATABalanceBefore = await getATABalance(banksClient, sender.usdcATA);

                      await withdraw({
                        withdrawalRecipient: sender.keys.publicKey,
                      });

                      const expectedStreamData = defaultStream().data;
                      expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;

                      await postWithdrawAssertions(
                        salts.default,
                        treasuryLamportsBefore,
                        sender.usdcATA,
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
                    const treasuryLamportsBefore = await getTreasuryLamports();

                    // Get the withdrawal recipient's token balance before the withdrawal
                    const withdrawalRecipientATABalanceBefore = await getATABalance(banksClient, recipient.usdcATA);

                    await withdraw();

                    const expectedStreamData = defaultStream().data;
                    expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;

                    await postWithdrawAssertions(
                      salts.default,
                      treasuryLamportsBefore,
                      recipient.usdcATA,
                      withdrawalRecipientATABalanceBefore,
                      expectedStreamData,
                    );
                  });
                });

                describe("when signer not recipient", () => {
                  describe("when stream status is SETTLED", () => {
                    it("should make the withdrawal", async () => {
                      await timeTravelTo(Time.END);

                      // Get the Lamports balance of the Treasury before the withdrawal
                      const treasuryLamportsBefore = await getTreasuryLamports();

                      // Get the withdrawal recipient's token balance before the withdrawal
                      const withdrawalRecipientATABalanceBefore = await getATABalance(banksClient, recipient.usdcATA);

                      await withdraw({
                        signer: sender.keys,
                        withdrawAmount: Amount.DEPOSIT,
                      });

                      const expectedStreamData = defaultStream().data;
                      expectedStreamData.amounts.withdrawn = Amount.DEPOSIT;
                      expectedStreamData.isCancelable = false;
                      expectedStreamData.isDepleted = true;

                      await postWithdrawAssertions(
                        salts.default,
                        treasuryLamportsBefore,
                        recipient.usdcATA,
                        withdrawalRecipientATABalanceBefore,
                        expectedStreamData,
                      );
                    });
                  });

                  describe("when stream status is not SETTLED", () => {
                    describe("when stream status is CANCELED", () => {
                      it("should make the withdrawal", async () => {
                        await cancel();

                        // Get the Lamports balance of the Treasury before the withdrawal
                        const treasuryLamportsBefore = await getTreasuryLamports();

                        // Get the withdrawal recipient's token balance before the withdrawal
                        const withdrawalRecipientATABalanceBefore = await getATABalance(banksClient, recipient.usdcATA);

                        await withdraw({ signer: sender.keys });
                        const expectedStreamData = defaultStream({
                          isCancelable: false,
                          isDepleted: true,
                          wasCanceled: true,
                        }).data;
                        expectedStreamData.amounts.refunded = Amount.REFUND;
                        expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;

                        await postWithdrawAssertions(
                          salts.default,
                          treasuryLamportsBefore,
                          recipient.usdcATA,
                          withdrawalRecipientATABalanceBefore,
                          expectedStreamData,
                        );
                      });
                    });

                    describe("when stream status is STREAMING", () => {
                      describe("given token SPL standard", () => {
                        it("should make the withdrawal", async () => {
                          // Get the Lamports balance of the Treasury before the withdrawal
                          const treasuryLamportsBefore = await getTreasuryLamports();

                          // Get the withdrawal recipient's token balance before the withdrawal
                          const withdrawalRecipientATABalanceBefore = await getATABalance(
                            banksClient,
                            recipient.usdcATA,
                          );

                          await withdraw({ signer: sender.keys });
                          const expectedStreamData = defaultStream().data;
                          expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;
                          await postWithdrawAssertions(
                            salts.default,
                            treasuryLamportsBefore,
                            recipient.usdcATA,
                            withdrawalRecipientATABalanceBefore,
                            expectedStreamData,
                          );
                        });
                      });

                      describe("given token 2022 standard", () => {
                        it("should make the withdrawal", async () => {
                          const salt = await createWithTimestampsToken2022();

                          // Get the Lamports balance of the Treasury before the withdrawal
                          const treasuryLamportsBefore = await getTreasuryLamports();

                          // Get the withdrawal recipient's token balance before the withdrawal
                          const withdrawalRecipientATABalanceBefore = await getATABalance(
                            banksClient,
                            recipient.daiATA,
                          );

                          await withdrawToken2022(salt, sender.keys);

                          const expectedStreamData = defaultStreamToken2022({
                            salt: salt,
                          }).data;
                          expectedStreamData.amounts.withdrawn = Amount.WITHDRAW;
                          await postWithdrawAssertions(
                            salt,
                            treasuryLamportsBefore,
                            recipient.daiATA,
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
  treasuryLamportsBefore: BN,
  withdrawalRecipientATA: PublicKey,
  withdrawalRecipientATABalanceBefore: BN,
  expectedStreamData: StreamData,
) {
  // Assert that the Stream state has been updated correctly
  const actualStreamData = await fetchStreamData(salt);
  assertEqStreamData(actualStreamData, expectedStreamData);

  // Get the Lamports balance of the Treasury after the withdrawal
  const treasuryLamportsAfter = await getTreasuryLamports();

  // Assert that the Treasury's balance has been credited with the withdrawal fee
  assertEqualBalanceSOL(treasuryLamportsAfter, treasuryLamportsBefore.add(Amount.WITHDRAW_FEE));

  // Get the withdrawal recipient's token balance
  const withdrawalRecipientTokenBalance = await getATABalance(banksClient, withdrawalRecipientATA);

  // Assert that the withdrawal recipient's token balance has been changed correctly
  const expectedWithdrawnAmount = expectedStreamData.amounts.withdrawn;
  assertEqualBn(withdrawalRecipientTokenBalance, withdrawalRecipientATABalanceBefore.add(expectedWithdrawnAmount));

  // TODO: Assert that the StreamData ATA has been changed correctly
}
