import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { assert } from "chai";

import { assertErrorHexCode, assertEqStreamDatas } from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";
import {
  banksClient,
  cancel,
  cancelToken2022,
  createWithTimestampsToken2022,
  defaultStreamData,
  defaultStreamDataToken2022,
  fetchStreamData,
  getATABalance,
  getTreasuryATABalanceSPL,
  getTreasuryATABalanceToken2022,
  ids,
  randomToken,
  recipient,
  sender,
  setUp,
  sleepFor,
  timeTravelTo,
  treasuryATASpl,
  treasuryATAToken2022,
  withdrawMax,
} from "../base";

describe("cancel", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp(false);
      // Set the time to 26% of the stream duration
      await timeTravelTo(defaults.PASS_26_PERCENT);
    });

    it("should revert", async () => {
      try {
        await cancel({ streamId: new BN(1) });
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
          await cancel({ streamId: ids.nullStream });
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });

    context("given a valid stream", () => {
      context("given an invalid asset mint", () => {
        it("should revert", async () => {
          try {
            await cancel({ assetMint: randomToken });
          } catch (error) {
            assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
          }
        });
      });

      context("given a valid asset mint", () => {
        context("given cold stream", () => {
          context("given DEPLETED status", () => {
            it("should revert", async () => {
              await timeTravelTo(defaults.END_TIME);
              await withdrawMax();
              try {
                await cancel();
              } catch (error) {
                assertErrorHexCode(error, getErrorCode("StreamDepleted"));
              }
            });
          });

          context("given CANCELED status", () => {
            it("should revert", async () => {
              await cancel();
              // Sleep for 5 ms to allow the tx to be processed
              await sleepFor(5);
              try {
                await cancel();
              } catch (error) {
                assertErrorHexCode(error, getErrorCode("StreamCanceled"));
              }
            });
          });

          context("given SETTLED status", () => {
            it("should revert", async () => {
              await timeTravelTo(defaults.END_TIME);
              try {
                await cancel();
              } catch (error) {
                assertErrorHexCode(error, getErrorCode("StreamSettled"));
              }
            });
          });
        });

        context("given warm stream", () => {
          context("when signer not sender", () => {
            it("should revert", async () => {
              try {
                await cancel({ signer: recipient.keys });
              } catch (error) {
                assertErrorHexCode(error, getErrorCode("ConstraintAddress"));
              }
            });
          });

          context("when signer sender", () => {
            context("given non cancelable stream", () => {
              it("should revert", async () => {
                try {
                  await cancel({ streamId: ids.nonCancelableStream });
                } catch (error) {
                  assertErrorHexCode(
                    error,
                    getErrorCode("StreamIsNotCancelable")
                  );
                }
              });
            });

            context("given cancelable stream", () => {
              context("given PENDING status", () => {
                it("should cancel the stream", async () => {
                  // Go back in time so that the stream is PENDING
                  await timeTravelTo(defaults.APR_1_2025);

                  // Get the sender's ATA balance before the cancel
                  const senderATABalanceBefore = await getATABalance(
                    banksClient,
                    sender.usdcATA
                  );

                  // Get the treasury's ATA balance before the cancel
                  const treasuryATABalanceBefore =
                    await getTreasuryATABalanceSPL();

                  // Cancel the stream
                  await cancel();

                  // Assert the cancelation
                  const expectedStreamData = defaultStreamData({
                    isCancelable: false,
                    isDepleted: true,
                    wasCanceled: true,
                  });
                  expectedStreamData.amounts.refunded = defaults.DEPOSIT_AMOUNT;
                  await postCancelAssertionsSPL(
                    ids.defaultStream,
                    senderATABalanceBefore,
                    treasuryATABalanceBefore,
                    expectedStreamData
                  );
                });
              });

              context("given STREAMING status", () => {
                context("given token SPL standard", () => {
                  it("should cancel the stream", async () => {
                    // Get the sender's ATA balance before the cancel
                    const senderATABalanceBefore = await getATABalance(
                      banksClient,
                      sender.usdcATA
                    );

                    // Get the treasury's ATA balance before the cancel
                    const treasuryATABalanceBefore =
                      await getTreasuryATABalanceSPL();

                    // Cancel the stream
                    await cancel();

                    // Assert the cancelation
                    const expectedStreamData = defaultStreamData({
                      isCancelable: false,
                      wasCanceled: true,
                    });
                    expectedStreamData.amounts.refunded =
                      defaults.REFUND_AMOUNT;
                    await postCancelAssertionsSPL(
                      ids.defaultStream,
                      senderATABalanceBefore,
                      treasuryATABalanceBefore,
                      expectedStreamData
                    );
                  });
                });

                context("given token 2022 standard", () => {
                  it("should cancel the stream", async () => {
                    // Create a stream with a Token2022 mint
                    const { streamId } = await createWithTimestampsToken2022();

                    // Get the sender's ATA balance before the cancel
                    const senderATABalanceBefore = await getATABalance(
                      banksClient,
                      sender.daiATA
                    );

                    // Get the treasury's ATA balance before the cancel
                    const treasuryATABalanceBefore =
                      await getTreasuryATABalanceToken2022();

                    // Cancel the stream
                    await cancelToken2022(streamId);

                    // Assert the cancelation
                    const expectedStreamData = defaultStreamDataToken2022({
                      id: streamId,
                    });
                    expectedStreamData.amounts.refunded =
                      defaults.REFUND_AMOUNT;
                    expectedStreamData.isCancelable = false;
                    expectedStreamData.wasCanceled = true;
                    await postCancelAssertionsToken2022(
                      streamId,
                      senderATABalanceBefore,
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

async function postCancelAssertions(
  streamId: BN,
  senderATA: PublicKey,
  treasuryATA: PublicKey,
  senderATABalanceBefore: BN,
  treasuryATABalanceBefore: BN,
  expectedStreamData: any
) {
  // Get Sender's ATA balance after the cancel
  const senderATABalanceAfter = await getATABalance(banksClient, senderATA);

  // Assert that the sender's token balance has been changed correctly
  const expectedRefundedAmount = expectedStreamData.amounts.refunded;
  assert(
    senderATABalanceAfter.eq(
      senderATABalanceBefore.add(expectedRefundedAmount)
    ),
    "The amount refunded to the sender is incorrect"
  );

  // Assert that the Treasury ATA has been changed correctly
  const treasuryBalance = await getATABalance(banksClient, treasuryATA);

  assert(
    treasuryBalance.eq(treasuryATABalanceBefore.sub(expectedRefundedAmount)),
    "The Treasury's token balance is incorrect"
  );

  // Assert that the Stream state has been updated correctly
  const actualStreamData = await fetchStreamData(streamId);
  assertEqStreamDatas(actualStreamData, expectedStreamData);
}

async function postCancelAssertionsSPL(
  streamId: BN,
  senderATABalanceBefore: BN,
  treasuryATABalanceBefore: BN,
  expectedStreamData: any,
  senderATA = sender.usdcATA
) {
  await postCancelAssertions(
    streamId,
    senderATA,
    treasuryATASpl,
    senderATABalanceBefore,
    treasuryATABalanceBefore,
    expectedStreamData
  );
}

async function postCancelAssertionsToken2022(
  streamId: BN,
  senderATABalanceBefore: BN,
  treasuryATABalanceBefore: BN,
  expectedStreamData: any,
  senderATA = sender.daiATA
) {
  await postCancelAssertions(
    streamId,
    senderATA,
    treasuryATAToken2022,
    senderATABalanceBefore,
    treasuryATABalanceBefore,
    expectedStreamData
  );
}
