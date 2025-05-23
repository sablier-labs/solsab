import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { assert } from "chai";

import {
  cancel,
  createWithTimestampsToken2022,
  defaultStreamData,
  defaultStreamDataToken2022,
  fetchStreamData,
  getATABalance,
  getTreasuryLamports,
  getTreasuryATABalanceSPL,
  getTreasuryATABalanceToken2022,
  ids,
  randomToken,
  recipient,
  sender,
  setUp,
  timeTravelTo,
  treasuryATASpl,
  treasuryATAToken2022,
  withdrawMax,
  withdraw,
  withdrawToken2022,
  banksClient,
} from "../base";
import { assertErrorHexCode, assertEqStreamDatas } from "../utils/assertions";
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
        await withdraw({ streamId: new BN(1) });
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
          await withdraw({ streamId: ids.nullStream });
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });

    context("given a valid stream", () => {
      context("given an invalid asset mint", () => {
        it("should revert", async () => {
          try {
            await withdraw({ assetMint: randomToken });
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
                    } catch (error) {
                      assertErrorHexCode(error, getErrorCode("ConstraintRaw"));
                    }
                  });
                });

                context("when signer recipient", () => {
                  it("should make the withdrawal", async () => {
                    // Get the Lamports balance of the Treasury before the withdrawal
                    const treasuryLamportsBefore = await getTreasuryLamports();

                    // Get the withdrawal recipient's token balance before the withdrawal
                    const withdrawalRecipientATABalanceBefore =
                      await getATABalance(banksClient, sender.usdcATA);

                    const treasuryATABalanceBefore =
                      await getTreasuryATABalanceSPL();

                    await withdraw({
                      withdrawalRecipient: sender.keys.publicKey,
                    });

                    const expectedStreamData = defaultStreamData();
                    expectedStreamData.amounts.withdrawn =
                      defaults.WITHDRAW_AMOUNT;
                    await postWithdrawAssertionsSPL(
                      treasuryLamportsBefore,
                      sender.usdcATA,
                      withdrawalRecipientATABalanceBefore,
                      treasuryATABalanceBefore,
                      expectedStreamData
                    );
                  });
                });
              });

              context("when withdrawal address recipient", () => {
                context("when signer recipient", () => {
                  it("should make the withdrawal", async () => {
                    // Get the Lamports balance of the Treasury before the withdrawal
                    const treasuryLamportsBefore = await getTreasuryLamports();

                    // Get the withdrawal recipient's token balance before the withdrawal
                    const withdrawalRecipientATABalanceBefore =
                      await getATABalance(banksClient, recipient.usdcATA);

                    const treasuryATABalanceBefore =
                      await getTreasuryATABalanceSPL();

                    await withdraw();

                    const expectedStreamData = defaultStreamData();
                    expectedStreamData.amounts.withdrawn =
                      defaults.WITHDRAW_AMOUNT;
                    await postWithdrawAssertionsSPL(
                      treasuryLamportsBefore,
                      recipient.usdcATA,
                      withdrawalRecipientATABalanceBefore,
                      treasuryATABalanceBefore,
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

                      const treasuryATABalanceBefore =
                        await getTreasuryATABalanceSPL();

                      await withdraw({
                        withdrawAmount: defaults.DEPOSIT_AMOUNT,
                        signer: sender.keys,
                      });

                      const expectedStreamData = defaultStreamData();
                      expectedStreamData.amounts.withdrawn =
                        defaults.DEPOSIT_AMOUNT;
                      expectedStreamData.isCancelable = false;
                      expectedStreamData.isDepleted = true;
                      await postWithdrawAssertionsSPL(
                        treasuryLamportsBefore,
                        recipient.usdcATA,
                        withdrawalRecipientATABalanceBefore,
                        treasuryATABalanceBefore,
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

                        const treasuryATABalanceBefore =
                          await getTreasuryATABalanceSPL();

                        await withdraw({ signer: sender.keys });
                        const expectedStreamData = defaultStreamData({
                          isCancelable: false,
                          isDepleted: true,
                          wasCanceled: true,
                        });
                        expectedStreamData.amounts.refunded =
                          defaults.REFUND_AMOUNT;
                        expectedStreamData.amounts.withdrawn =
                          defaults.WITHDRAW_AMOUNT;
                        await postWithdrawAssertionsSPL(
                          treasuryLamportsBefore,
                          recipient.usdcATA,
                          withdrawalRecipientATABalanceBefore,
                          treasuryATABalanceBefore,
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

                          const treasuryATABalanceBefore =
                            await getTreasuryATABalanceSPL();

                          await withdraw({ signer: sender.keys });
                          const expectedStreamData = defaultStreamData();
                          expectedStreamData.amounts.withdrawn =
                            defaults.WITHDRAW_AMOUNT;
                          await postWithdrawAssertionsSPL(
                            treasuryLamportsBefore,
                            recipient.usdcATA,
                            withdrawalRecipientATABalanceBefore,
                            treasuryATABalanceBefore,
                            expectedStreamData
                          );
                        });
                      });

                      context("given token 2022 standard", () => {
                        it("should make the withdrawal", async () => {
                          const { streamId } =
                            await createWithTimestampsToken2022();

                          // Get the Lamports balance of the Treasury before the withdrawal
                          const treasuryLamportsBefore =
                            await getTreasuryLamports();

                          // Get the withdrawal recipient's token balance before the withdrawal
                          const withdrawalRecipientATABalanceBefore =
                            await getATABalance(banksClient, recipient.daiATA);

                          const treasuryATABalanceBefore =
                            await getTreasuryATABalanceToken2022();

                          await withdrawToken2022(streamId, sender.keys);

                          const expectedStreamData = defaultStreamDataToken2022(
                            {
                              id: streamId,
                            }
                          );
                          expectedStreamData.amounts.withdrawn =
                            defaults.WITHDRAW_AMOUNT;
                          await postWithdrawAssertionsToken2022(
                            treasuryLamportsBefore,
                            recipient.daiATA,
                            withdrawalRecipientATABalanceBefore,
                            treasuryATABalanceBefore,
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
  treasuryLamportsBefore: bigint,
  withdrawalRecipientATA: PublicKey,
  withdrawalRecipientATABalanceBefore: BN,
  treasuryATA: PublicKey,
  treasuryATABalanceBefore: BN,
  expectedStreamData: any
) {
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

  // Assert that the Treasury ATA has been changed correctly
  const treasuryATABalance = await getATABalance(banksClient, treasuryATA);

  assert(
    treasuryATABalance.eq(
      treasuryATABalanceBefore.sub(expectedWithdrawnAmount)
    ),
    "The Treasury's ATA balance is incorrect"
  );

  // Assert that the Stream state has been updated correctly
  const actualStreamData = await fetchStreamData(expectedStreamData.id);
  assertEqStreamDatas(actualStreamData, expectedStreamData);
}

async function postWithdrawAssertionsSPL(
  treasuryLamportsBefore: bigint,
  withdrawalRecipientATA: PublicKey,
  withdrawalRecipientATABalanceBefore: BN,
  treasuryATABalanceBefore: BN,
  expectedStreamData: any
) {
  await postWithdrawAssertions(
    treasuryLamportsBefore,
    withdrawalRecipientATA,
    withdrawalRecipientATABalanceBefore,
    treasuryATASpl,
    treasuryATABalanceBefore,
    expectedStreamData
  );
}

async function postWithdrawAssertionsToken2022(
  treasuryLamportsBefore: bigint,
  withdrawalRecipientATA: PublicKey,
  withdrawalRecipientATABalanceBefore: BN,
  treasuryATABalanceBefore: BN,
  expectedStreamData: any
) {
  await postWithdrawAssertions(
    treasuryLamportsBefore,
    withdrawalRecipientATA,
    withdrawalRecipientATABalanceBefore,
    treasuryATAToken2022,
    treasuryATABalanceBefore,
    expectedStreamData
  );
}
