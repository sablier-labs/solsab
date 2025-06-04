import { BN } from "@coral-xyz/anchor";
import { assert } from "chai";

import { Stream } from "../utils/types";

import { assertEqStreamDatas, assertErrorHexCode } from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";
import {
  accountExists,
  banksClient,
  cancel,
  cancelToken2022,
  createATAAndFund,
  createWithTimestamps,
  createWithTimestampsToken2022,
  defaultStream,
  defaultStreamToken2022,
  defaultTxSigner,
  deriveATAAddress,
  eve,
  fetchStreamData,
  getATABalance,
  getATABalanceMint,
  randomToken,
  salts,
  sender,
  setUp,
  sleepFor,
  timeTravelTo,
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
        await cancel({ salt: new BN(1) });

        assert.fail("Expected the tx to revert, but it succeeded.");
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
          await cancel({ salt: salts.nonExisting });

          assert.fail("Expected the tx to revert, but it succeeded.");
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
        }
      });
    });

    context("given a valid stream", () => {
      context("given an invalid deposit mint", () => {
        it("should revert", async () => {
          try {
            await cancel({ depositedTokenMint: randomToken });

            assert.fail("Expected the tx to revert, but it succeeded.");
          } catch (error) {
            assertErrorHexCode(error, getErrorCode("AccountNotInitialized"));
          }
        });
      });

      context("given a valid deposit mint", () => {
        context("given cold stream", () => {
          context("given DEPLETED status", () => {
            it("should revert", async () => {
              await timeTravelTo(defaults.END_TIME);
              await withdrawMax();
              try {
                await cancel();

                assert.fail("Expected the tx to revert, but it succeeded.");
              } catch (error) {
                assertErrorHexCode(error, getErrorCode("StreamDepleted"));
              }
            });
          });

          context("given CANCELED status", () => {
            it("should revert", async () => {
              await cancel();
              // Sleep for 5 ms to allow the tx to be processed
              await sleepFor(7);
              try {
                await cancel();

                assert.fail("Expected the tx to revert, but it succeeded.");
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

                assert.fail("Expected the tx to revert, but it succeeded.");
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
                await cancel({ signer: eve.keys });
              } catch (error) {
                assertErrorHexCode(error, getErrorCode("ConstraintAddress"));
              }
            });
          });

          context("when signer sender", () => {
            context("given non cancelable stream", () => {
              it("should revert", async () => {
                try {
                  await cancel({ salt: salts.nonCancelable });

                  assert.fail("Expected the tx to revert, but it succeeded.");
                } catch (error) {
                  assertErrorHexCode(
                    error,
                    getErrorCode("StreamIsNotCancelable")
                  );
                }
              });
            });

            context("given cancelable stream", () => {
              context("when the sender does not have ATA", () => {
                it("should cancel the stream", async () => {
                  // Create ATA for & mint random token to the stream creator
                  await createATAAndFund(
                    randomToken,
                    defaults.USDC_USER_BALANCE,
                    defaults.TOKEN_PROGRAM_ID,
                    defaultTxSigner.keys.publicKey
                  );

                  // Create a stream with a random token
                  const salt = await createWithTimestamps({
                    depositTokenMint: randomToken,
                    depositTokenProgram: defaults.TOKEN_PROGRAM_ID,
                  });

                  // Derive the sender's ATA for the random token
                  const senderATA = deriveATAAddress(
                    randomToken,
                    sender.keys.publicKey,
                    defaults.TOKEN_PROGRAM_ID
                  );

                  // Assert the sender's ATA doesn't exist
                  assert.isFalse(await accountExists(senderATA));

                  // Cancel the stream
                  await cancel({
                    salt,
                    depositedTokenMint: randomToken,
                    depositedTokenProgram: defaults.TOKEN_PROGRAM_ID,
                  });

                  // Assert the cancelation
                  const expectedStream = defaultStream({
                    salt: salt,
                    isCancelable: false,
                    wasCanceled: true,
                    depositedTokenMint: randomToken,
                    depositedTokenProgram: defaults.TOKEN_PROGRAM_ID,
                  });
                  expectedStream.data.amounts.refunded = defaults.REFUND_AMOUNT;

                  // Assert the cancelation
                  await postCancelAssertions(salt, expectedStream, new BN(0));
                });
              });

              context("when the sender has ATA", () => {
                context("given PENDING status", () => {
                  it("should cancel the stream", async () => {
                    // Go back in time so that the stream is PENDING
                    await timeTravelTo(defaults.APR_1_2025);

                    const beforeSenderBalance = await getATABalance(
                      banksClient,
                      sender.usdcATA
                    );

                    // Cancel the stream
                    await cancel();

                    // Assert the cancelation
                    const expectedStream = defaultStream({
                      isCancelable: false,
                      isDepleted: true,
                      wasCanceled: true,
                    });
                    expectedStream.data.amounts.refunded =
                      defaults.DEPOSIT_AMOUNT;

                    // Assert the cancelation
                    await postCancelAssertions(
                      salts.default,
                      expectedStream,
                      beforeSenderBalance
                    );
                  });
                });

                context("given STREAMING status", () => {
                  context("given token SPL standard", () => {
                    it("should cancel the stream", async () => {
                      const beforeSenderBalance = await getATABalance(
                        banksClient,
                        sender.usdcATA
                      );

                      // Cancel the stream
                      await cancel();

                      const expectedStream = defaultStream({
                        isCancelable: false,
                        wasCanceled: true,
                      });
                      expectedStream.data.amounts.refunded =
                        defaults.REFUND_AMOUNT;

                      // Assert the cancelation
                      await postCancelAssertions(
                        salts.default,
                        expectedStream,
                        beforeSenderBalance
                      );
                    });
                  });

                  context("given token 2022 standard", () => {
                    it("should cancel the stream", async () => {
                      // Create a stream with a Token2022 mint
                      const salt = await createWithTimestampsToken2022();

                      const beforeSenderBalance = await getATABalance(
                        banksClient,
                        sender.daiATA
                      );

                      // Cancel the stream
                      await cancelToken2022(salt);

                      const expectedStream = defaultStreamToken2022({
                        salt: salt,
                        isCancelable: false,
                        wasCanceled: true,
                      });
                      expectedStream.data.amounts.refunded =
                        defaults.REFUND_AMOUNT;

                      // Assert the cancelation
                      await postCancelAssertions(
                        salt,
                        expectedStream,
                        beforeSenderBalance
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

async function postCancelAssertions(
  salt: BN,
  expectedStream: Stream,
  beforeSenderBalance: BN
) {
  // Assert that the Stream state has been updated correctly
  const actualStreamData = await fetchStreamData(salt);
  assertEqStreamDatas(actualStreamData, expectedStream.data);

  // Assert the Sender's ATA balance
  const afterSenderBalance = await getATABalanceMint(
    banksClient,
    expectedStream.data.sender,
    expectedStream.data.depositedTokenMint
  );

  const actualBalanceRefunded = afterSenderBalance.sub(beforeSenderBalance);
  assert(
    actualBalanceRefunded.eq(expectedStream.data.amounts.refunded),
    "Sender's ATA balance mismatch"
  );

  // Assert the StreamData ATA balance
  const actualStreamDataBalance = await getATABalanceMint(
    banksClient,
    expectedStream.dataAddress,
    expectedStream.data.depositedTokenMint
  );
  const expectedStreamDataBalance = expectedStream.data.amounts.deposited.sub(
    expectedStream.data.amounts.refunded
  );
  assert(
    actualStreamDataBalance.eq(expectedStreamDataBalance),
    "StreamData's ATA balance mismatch"
  );
}
