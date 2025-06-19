import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import { createATAAndFund } from "../../anchor-bankrun-adapter";
import {
  cancel,
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
  withdrawMax,
  withdraw,
  withdrawToken2022,
  createWithTimestamps,
} from "../base";
import {
  accountExists,
  banksClient,
  randomToken,
  recipient,
  timeTravelTo,
} from "../../common-base";
import {
  assert,
  assertErrorHexCode,
  assertEqStreamDatas,
  assertFail,
} from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";

describe("withdraw", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp(false);
      // Set the time to 26% of the stream duration
      await timeTravelTo(defaults.PASS_26_PERCENT);
    });

    it("should revert", async () => {
      try {
        await withdraw({ salt: new BN(1) });
        assertFail();
      } catch (error) {
        assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
      }
    });
  });

  context("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
      // Set the time to 26% of the stream duration
      await timeTravelTo(defaults.PASS_26_PERCENT);
    });

    context("given a null stream", () => {
      it("should revert", async () => {
        try {
          await withdraw({ salt: salts.nonExisting });
          assertFail();
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });

    context("given a valid stream", () => {
      context("given an invalid asset mint", () => {
        it("should revert", async () => {
          try {
            await withdraw({ depositedTokenMint: randomToken });

            assertFail();
          } catch (error) {
            assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
          }
        });
      });

      context("given a valid asset mint", () => {
        context("when stream status is DEPLETED", () => {
          it("should revert", async () => {
            await timeTravelTo(defaults.END_TIME);
            await withdrawMax();
            try {
              await withdraw();
              assertFail();
            } catch (error) {
              assertErrorHexCode(error, getErrorCode("StreamDepleted"));
            }
          });
        });

        context("when stream status is not DEPLETED", () => {
          context("when zero withdraw amount", () => {
            it("should revert", async () => {
              try {
                await withdraw({
                  withdrawAmount: defaults.ZERO_BN,
                });
                assertFail();
              } catch (error) {
                assertErrorHexCode(error, getErrorCode("WithdrawAmountZero"));
              }
            });
          });

          context("when non zero withdraw amount", () => {
            context("when withdraw amount overdraws", () => {
              it("should revert", async () => {
                try {
                  await withdraw({
                    withdrawAmount: defaults.WITHDRAW_AMOUNT.add(new BN(1)),
                  });
                  assertFail();
                } catch (error) {
                  assertErrorHexCode(error, getErrorCode("Overdraw"));
                }
              });
            });

            context("when withdraw amount does not overdraw", () => {
              context("when withdrawal address not recipient", () => {
                context("when signer not recipient", () => {
                  it("should revert", async () => {
                    try {
                      await withdraw({
                        signer: sender.keys,
                        withdrawalRecipient: sender.keys.publicKey,
                      });

                      assert.fail(
                        "Expected the tx to revert, but it succeeded."
                      );
                    } catch (error) {
                      assertErrorHexCode(error, getErrorCode("ConstraintRaw"));
                    }
                  });
                });

                context(
                  "when recipient doesn't have an ATA for the Stream's asset",
                  () => {
                    it("should create the ATA", async () => {
                      // Set up the sender for the test
                      await createATAAndFund(
                        banksClient,
                        sender.keys,
                        randomToken,
                        defaults.DEPOSIT_AMOUNT.toNumber(),
                        defaults.TOKEN_PROGRAM_ID,
                        sender.keys.publicKey
                      );

                      // Create a new stream with a random token
                      const salt = await createWithTimestamps({
                        depositTokenMint: randomToken,
                        depositAmount: defaults.DEPOSIT_AMOUNT,
                      });

                      // Derive the recipient's ATA address
                      const recipientATA = deriveATAAddress(
                        randomToken,
                        recipient.keys.publicKey,
                        defaults.TOKEN_PROGRAM_ID
                      );

                      // Assert that the recipient's ATA does not exist
                      assert(
                        !(await accountExists(recipientATA)),
                        "Recipient's ATA shouldn't exist before the withdrawal"
                      );

                      // Perform the withdrawal
                      await withdraw({
                        salt,
                        depositedTokenMint: randomToken,
                      });

                      // Assert that the recipient's ATA was created
                      assert(
                        await accountExists(recipientATA),
                        "Recipient's ATA should exist after the withdrawal"
                      );
                    });
                  }
                );

                context(
                  "when recipient has an ATA for the Stream's asset",
                  () => {
                    context("when signer recipient", () => {
                      it("should make the withdrawal", async () => {
                        // Get the Lamports balance of the Treasury before the withdrawal
                        const treasuryLamportsBefore =
                          await getTreasuryLamports();

                        // Get the withdrawal recipient's token balance before the withdrawal
                        const withdrawalRecipientATABalanceBefore =
                          await getATABalance(banksClient, sender.usdcATA);

                        await withdraw({
                          withdrawalRecipient: sender.keys.publicKey,
                        });

                        const expectedStreamData = defaultStream().data;
                        expectedStreamData.amounts.withdrawn =
                          defaults.WITHDRAW_AMOUNT;

                        await postWithdrawAssertions(
                          salts.default,
                          treasuryLamportsBefore,
                          sender.usdcATA,
                          withdrawalRecipientATABalanceBefore,
                          expectedStreamData
                        );
                      });
                    });
                  }
                );
              });

              context("when withdrawal address recipient", () => {
                context("when signer recipient", () => {
                  it("should make the withdrawal", async () => {
                    // Get the Lamports balance of the Treasury before the withdrawal
                    const treasuryLamportsBefore = await getTreasuryLamports();

                    // Get the withdrawal recipient's token balance before the withdrawal
                    const withdrawalRecipientATABalanceBefore =
                      await getATABalance(banksClient, recipient.usdcATA);

                    await withdraw();

                    const expectedStreamData = defaultStream().data;
                    expectedStreamData.amounts.withdrawn =
                      defaults.WITHDRAW_AMOUNT;

                    await postWithdrawAssertions(
                      salts.default,
                      treasuryLamportsBefore,
                      recipient.usdcATA,
                      withdrawalRecipientATABalanceBefore,
                      expectedStreamData
                    );
                  });
                });

                context("when signer not recipient", () => {
                  context("when stream status is SETTLED", () => {
                    it("should make the withdrawal", async () => {
                      await timeTravelTo(defaults.END_TIME);

                      // Get the Lamports balance of the Treasury before the withdrawal
                      const treasuryLamportsBefore =
                        await getTreasuryLamports();

                      // Get the withdrawal recipient's token balance before the withdrawal
                      const withdrawalRecipientATABalanceBefore =
                        await getATABalance(banksClient, recipient.usdcATA);

                      await withdraw({
                        withdrawAmount: defaults.DEPOSIT_AMOUNT,
                        signer: sender.keys,
                      });

                      const expectedStreamData = defaultStream().data;
                      expectedStreamData.amounts.withdrawn =
                        defaults.DEPOSIT_AMOUNT;
                      expectedStreamData.isCancelable = false;
                      expectedStreamData.isDepleted = true;

                      await postWithdrawAssertions(
                        salts.default,
                        treasuryLamportsBefore,
                        recipient.usdcATA,
                        withdrawalRecipientATABalanceBefore,
                        expectedStreamData
                      );
                    });
                  });

                  context("when stream status is not SETTLED", () => {
                    context("when stream status is CANCELED", () => {
                      it("should make the withdrawal", async () => {
                        await cancel();

                        // Get the Lamports balance of the Treasury before the withdrawal
                        const treasuryLamportsBefore =
                          await getTreasuryLamports();

                        // Get the withdrawal recipient's token balance before the withdrawal
                        const withdrawalRecipientATABalanceBefore =
                          await getATABalance(banksClient, recipient.usdcATA);

                        await withdraw({ signer: sender.keys });
                        const expectedStreamData = defaultStream({
                          isCancelable: false,
                          isDepleted: true,
                          wasCanceled: true,
                        }).data;
                        expectedStreamData.amounts.refunded =
                          defaults.REFUND_AMOUNT;
                        expectedStreamData.amounts.withdrawn =
                          defaults.WITHDRAW_AMOUNT;

                        await postWithdrawAssertions(
                          salts.default,
                          treasuryLamportsBefore,
                          recipient.usdcATA,
                          withdrawalRecipientATABalanceBefore,
                          expectedStreamData
                        );
                      });
                    });

                    context("when stream status is STREAMING", () => {
                      context("given token SPL standard", () => {
                        it("should make the withdrawal", async () => {
                          // Get the Lamports balance of the Treasury before the withdrawal
                          const treasuryLamportsBefore =
                            await getTreasuryLamports();

                          // Get the withdrawal recipient's token balance before the withdrawal
                          const withdrawalRecipientATABalanceBefore =
                            await getATABalance(banksClient, recipient.usdcATA);

                          await withdraw({ signer: sender.keys });
                          const expectedStreamData = defaultStream().data;
                          expectedStreamData.amounts.withdrawn =
                            defaults.WITHDRAW_AMOUNT;
                          await postWithdrawAssertions(
                            salts.default,
                            treasuryLamportsBefore,
                            recipient.usdcATA,
                            withdrawalRecipientATABalanceBefore,
                            expectedStreamData
                          );
                        });
                      });

                      context("given token 2022 standard", () => {
                        it("should make the withdrawal", async () => {
                          const salt = await createWithTimestampsToken2022();

                          // Get the Lamports balance of the Treasury before the withdrawal
                          const treasuryLamportsBefore =
                            await getTreasuryLamports();

                          // Get the withdrawal recipient's token balance before the withdrawal
                          const withdrawalRecipientATABalanceBefore =
                            await getATABalance(banksClient, recipient.daiATA);

                          await withdrawToken2022(salt, sender.keys);

                          const expectedStreamData = defaultStreamToken2022({
                            salt: salt,
                          }).data;
                          expectedStreamData.amounts.withdrawn =
                            defaults.WITHDRAW_AMOUNT;
                          await postWithdrawAssertions(
                            salt,
                            treasuryLamportsBefore,
                            recipient.daiATA,
                            withdrawalRecipientATABalanceBefore,
                            expectedStreamData
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
  treasuryLamportsBefore: bigint,
  withdrawalRecipientATA: PublicKey,
  withdrawalRecipientATABalanceBefore: BN,
  expectedStreamData: any
) {
  // Assert that the Stream state has been updated correctly
  const actualStreamData = await fetchStreamData(salt);
  assertEqStreamDatas(actualStreamData, expectedStreamData);

  // Get the Lamports balance of the Treasury after the withdrawal
  const treasuryLamportsAfter = await getTreasuryLamports();

  // Assert that the Treasury's balance has been credited with the withdrawal fee
  assert(
    treasuryLamportsAfter ===
      treasuryLamportsBefore + BigInt(defaults.WITHDRAWAL_FEE_AMOUNT),
    "The Treasury's Lamports balance hasn't been credited correctly"
  );

  // Get the withdrawal recipient's token balance
  const withdrawalRecipientTokenBalance = await getATABalance(
    banksClient,
    withdrawalRecipientATA
  );

  // Assert that the withdrawal recipient's token balance has been changed correctly
  const expectedWithdrawnAmount = expectedStreamData.amounts.withdrawn;
  assert(
    withdrawalRecipientTokenBalance.eq(
      withdrawalRecipientATABalanceBefore.add(expectedWithdrawnAmount)
    ),
    "The amount withdrawn to the withdrawal recipient is incorrect"
  );

  // TODO: Assert that the StreamData ATA has been changed correctly
}
