import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_ADDRESS as CONSTRAINT_ADDRESS,
} from "@coral-xyz/anchor-errors";
import type BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, ZERO } from "../../../lib/constants";
import { sleepFor } from "../../../lib/helpers";
import { createATAAndFund, deriveATAAddress } from "../../common/anchor-bankrun";
import { assertAccountNotExists, assertEqualBn } from "../../common/assertions";
import { banksClient, defaultBankrunPayer, randomToken, recipient, timeTravelTo } from "../../common/base";
import {
  cancel,
  cancelToken2022,
  createWithTimestamps,
  createWithTimestampsToken2022,
  defaultStream,
  defaultStreamToken2022,
  fetchStreamData,
  getATABalance,
  getATABalanceMint,
  salts,
  sender,
  setUp,
  withdrawMax,
} from "../base";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { Amount, ProgramId, Time } from "../utils/defaults";
import { type Stream } from "../utils/types";

describe("cancel", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({ initProgram: false });
      // Set the time to 26% of the stream duration
      await timeTravelTo(Time.MID_26_PERCENT);
    });

    it("should revert", async () => {
      await expectToThrow(cancel({ salt: BN_1 }), ACCOUNT_NOT_INITIALIZED);
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
        await expectToThrow(cancel({ salt: salts.nonExisting }), ACCOUNT_NOT_INITIALIZED);
      });
    });

    describe("given a valid stream", () => {
      describe("given an invalid deposited token mint", () => {
        it("should revert", async () => {
          await expectToThrow(cancel({ depositedTokenMint: randomToken }), ACCOUNT_NOT_INITIALIZED);
        });
      });

      describe("given a valid deposited token mint", () => {
        describe("given cold stream", () => {
          describe("given DEPLETED status", () => {
            it("should revert", async () => {
              await timeTravelTo(Time.END);
              await withdrawMax();
              await expectToThrow(cancel(), "StreamDepleted");
            });
          });

          describe("given CANCELED status", () => {
            it("should revert", async () => {
              await cancel();
              // Sleep for 5 ms to allow the tx to be processed
              await sleepFor(7);
              await expectToThrow(cancel(), "StreamCanceled");
            });
          });

          describe("given SETTLED status", () => {
            it("should revert", async () => {
              await timeTravelTo(Time.END);
              await expectToThrow(cancel(), "StreamSettled");
            });
          });
        });

        describe("given warm stream", () => {
          describe("when signer not sender", () => {
            it("should revert", async () => {
              await expectToThrow(cancel({ signer: recipient.keys }), CONSTRAINT_ADDRESS);
            });
          });

          describe("when signer sender", () => {
            describe("given non cancelable stream", () => {
              it("should revert", async () => {
                await expectToThrow(cancel({ salt: salts.nonCancelable }), "StreamIsNotCancelable");
              });
            });

            describe("given cancelable stream", () => {
              describe("when the sender does not have ATA", () => {
                it("should cancel the stream", async () => {
                  // Derive the sender's ATA for the random token
                  const senderATA = deriveATAAddress(randomToken, sender.keys.publicKey, ProgramId.TOKEN);

                  // Assert the sender's ATA doesn't exist
                  await assertAccountNotExists(senderATA, "Sender's ATA");

                  // Create ATA for & mint random token to the stream creator
                  await createATAAndFund(
                    banksClient,
                    defaultBankrunPayer,
                    randomToken,
                    Amount.DEPOSIT,
                    ProgramId.TOKEN,
                    sender.keys.publicKey,
                  );

                  // Create a stream with a random token
                  const salt = await createWithTimestamps({
                    creator: sender.keys,
                    depositTokenMint: randomToken,
                    depositTokenProgram: ProgramId.TOKEN,
                  });

                  // Cancel the stream
                  await cancel({
                    depositedTokenMint: randomToken,
                    depositedTokenProgram: ProgramId.TOKEN,
                    salt,
                  });

                  // Assert the cancelation
                  const expectedStream = defaultStream({
                    depositedTokenMint: randomToken,
                    isCancelable: false,
                    salt: salt,
                    tokenProgram: ProgramId.TOKEN,
                    wasCanceled: true,
                  });
                  expectedStream.data.amounts.refunded = Amount.REFUND;

                  // Assert the cancelation
                  await postCancelAssertions(salt, expectedStream, ZERO);
                });
              });

              describe("given PENDING status", () => {
                it("should cancel the stream", async () => {
                  // Go back in time so that the stream is PENDING
                  await timeTravelTo(Time.GENESIS);

                  const beforeSenderBalance = await getATABalance(banksClient, sender.usdcATA);

                  // Cancel the stream
                  await cancel();

                  // Assert the cancelation
                  const expectedStream = defaultStream({
                    isCancelable: false,
                    isDepleted: true,
                    wasCanceled: true,
                  });
                  expectedStream.data.amounts.refunded = Amount.DEPOSIT;

                  // Assert the cancelation
                  await postCancelAssertions(salts.default, expectedStream, beforeSenderBalance);
                });
              });

              describe("given STREAMING status", () => {
                describe("given token SPL standard", () => {
                  it("should cancel the stream", async () => {
                    const beforeSenderBalance = await getATABalance(banksClient, sender.usdcATA);

                    // Cancel the stream
                    await cancel();

                    const expectedStream = defaultStream({
                      isCancelable: false,
                      wasCanceled: true,
                    });
                    expectedStream.data.amounts.refunded = Amount.REFUND;

                    // Assert the cancelation
                    await postCancelAssertions(salts.default, expectedStream, beforeSenderBalance);
                  });
                });

                describe("given token 2022 standard", () => {
                  it("should cancel the stream", async () => {
                    // Create a stream with a Token2022 mint
                    const salt = await createWithTimestampsToken2022();

                    const beforeSenderBalance = await getATABalance(banksClient, sender.daiATA);

                    // Cancel the stream
                    await cancelToken2022(salt);

                    const expectedStream = defaultStreamToken2022({
                      isCancelable: false,
                      salt: salt,
                      wasCanceled: true,
                    });
                    expectedStream.data.amounts.refunded = Amount.REFUND;

                    // Assert the cancelation
                    await postCancelAssertions(salt, expectedStream, beforeSenderBalance);
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

async function postCancelAssertions(salt: BN, expectedStream: Stream, beforeSenderBalance: BN) {
  // Assert that the Stream state has been updated correctly
  const actualStreamData = await fetchStreamData(salt);
  assertEqStreamData(actualStreamData, expectedStream.data);

  // Assert the Sender's ATA balance
  const afterSenderBalance = await getATABalanceMint(
    banksClient,
    expectedStream.data.sender,
    expectedStream.data.depositedTokenMint,
  );

  const actualBalanceRefunded = afterSenderBalance.sub(beforeSenderBalance);
  assertEqualBn(actualBalanceRefunded, expectedStream.data.amounts.refunded);

  // Assert the StreamData ATA balance
  const actualStreamDataBalance = await getATABalanceMint(
    banksClient,
    expectedStream.dataAddress,
    expectedStream.data.depositedTokenMint,
  );
  const expectedStreamDataBalance = expectedStream.data.amounts.deposited.sub(expectedStream.data.amounts.refunded);
  assertEqualBn(actualStreamDataBalance, expectedStreamDataBalance);
}
