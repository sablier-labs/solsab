import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, BN_1000, ZERO } from "../../../lib/constants";
import { assertAccountExists, assertEqualBn } from "../../common/assertions";
import { banksClient, dai, randomToken } from "../../common/base";
import {
  createWithTimestamps,
  createWithTimestampsToken2022,
  defaultStream,
  defaultStreamToken2022,
  fetchStreamData,
  getATABalance,
  getMintTotalSupplyOf,
  getSenderTokenBalance,
  sender,
  setUp,
} from "../base";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { AMOUNTS, Amount, TIMESTAMPS, Time, UNLOCK_AMOUNTS } from "../utils/defaults";

describe("createWithTimestamps", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      await setUp({ initProgram: false });
    });

    it("should revert", async () => {
      await expectToThrow(createWithTimestamps({ salt: ZERO }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    describe("when deposit amount zero", () => {
      it("should revert", async () => {
        await expectToThrow(createWithTimestamps({ depositAmount: ZERO }), "DepositAmountZero");
      });
    });

    describe("when deposit amount not zero", () => {
      describe("when start time is zero", () => {
        it("should revert", async () => {
          await expectToThrow(
            createWithTimestamps({
              timestamps: TIMESTAMPS({ start: ZERO }),
            }),
            "StartTimeNotPositive",
          );
        });
      });

      describe("when start time is not zero", () => {
        describe("when start time is not positive", () => {
          it("should revert", async () => {
            await expectToThrow(
              createWithTimestamps({
                timestamps: TIMESTAMPS({ start: new BN(-1) }),
              }),
              "StartTimeNotPositive",
            );
          });
        });

        describe("when start time is positive", () => {
          describe("when sender lacks an ATA for deposited token", () => {
            it("should revert", async () => {
              await expectToThrow(
                createWithTimestamps({
                  depositTokenMint: randomToken,
                }),
                ACCOUNT_NOT_INITIALIZED,
              );
            });
          });

          describe("when sender has an ATA for deposited token", () => {
            describe("when sender has an insufficient token balance", () => {
              it("should revert", async () => {
                await expectToThrow(
                  createWithTimestamps({
                    depositAmount: new BN(1_000_000e6 + 1),
                  }),
                  0x1,
                );
              });
            });

            describe("when sender has a sufficient token balance", () => {
              describe("when cliff time zero", () => {
                describe("when cliff unlock amount not zero", () => {
                  it("should revert", async () => {
                    await expectToThrow(
                      createWithTimestamps({
                        timestamps: TIMESTAMPS({ cliff: ZERO }),
                      }),
                      "CliffTimeZeroUnlockAmountNotZero",
                    );
                  });
                });

                describe("when start time not less than end time", () => {
                  it("should revert", async () => {
                    await expectToThrow(
                      createWithTimestamps({
                        timestamps: TIMESTAMPS({ cliff: ZERO, start: Time.END }),
                      }),
                      "StartTimeNotLessThanEndTime",
                    );
                  });
                });

                describe("when start time less than end time", () => {
                  it("should create the stream", async () => {
                    const beforeSenderTokenBalance = await getATABalance(banksClient, sender.usdcATA);

                    const salt = await createWithTimestamps({
                      timestamps: TIMESTAMPS({ cliff: ZERO }),
                      unlockAmounts: UNLOCK_AMOUNTS({ cliff: ZERO, start: ZERO }),
                    });

                    const expectedStream = defaultStream({
                      salt: salt,
                    });
                    expectedStream.data.timestamps.cliff = ZERO;
                    expectedStream.data.amounts = AMOUNTS({ cliffUnlock: ZERO, startUnlock: ZERO });

                    await assertStreamCreation(salt, beforeSenderTokenBalance, expectedStream);
                  });
                });
              });

              describe("when cliff time not zero", () => {
                describe("when start time not less than cliff time", () => {
                  it("should revert", async () => {
                    await expectToThrow(
                      createWithTimestamps({
                        timestamps: TIMESTAMPS({ start: Time.CLIFF }),
                      }),
                      "StartTimeNotLessThanCliffTime",
                    );
                  });
                });

                describe("when start time less than cliff time", () => {
                  describe("when cliff time not less than end time", () => {
                    it("should revert", async () => {
                      await expectToThrow(
                        createWithTimestamps({
                          timestamps: TIMESTAMPS({ cliff: Time.END }),
                        }),
                        "CliffTimeNotLessThanEndTime",
                      );
                    });
                  });

                  describe("when cliff time less than end time", () => {
                    describe("when unlock amounts sum exceeds deposit amount", () => {
                      it("should revert", async () => {
                        const depositAmount = BN_1000;
                        await expectToThrow(
                          createWithTimestamps({
                            depositAmount,
                            unlockAmounts: {
                              cliff: depositAmount,
                              start: depositAmount,
                            },
                          }),
                          "UnlockAmountsSumTooHigh",
                        );
                      });
                    });

                    describe("when unlock amounts sum not exceed deposit amount", () => {
                      describe("when token SPL standard", () => {
                        it("should create the stream", async () => {
                          const beforeSenderTokenBalance = await getATABalance(banksClient, sender.usdcATA);

                          const salt = await createWithTimestamps();

                          await assertStreamCreation(salt, beforeSenderTokenBalance);
                        });
                      });

                      describe("when token 2022 standard", () => {
                        it("should create the stream", async () => {
                          const beforeSenderTokenBalance = await getSenderTokenBalance(dai);
                          const salt = await createWithTimestampsToken2022();

                          await assertStreamCreation(
                            salt,
                            beforeSenderTokenBalance,
                            defaultStreamToken2022({ salt: salt }),
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

async function assertStreamCreation(
  salt: BN,
  beforeSenderTokenBalance: BN,
  expectedStream = defaultStream({ salt: salt }),
) {
  await assertAccountExists(expectedStream.nftMintAddress, "Stream NFT Mint");
  await assertAccountExists(expectedStream.dataAddress, "Stream Data");
  await assertAccountExists(expectedStream.dataAta, "Stream Data ATA");
  await assertAccountExists(expectedStream.nftMasterEdition, "Stream NFT Master Edition");
  await assertAccountExists(expectedStream.nftMetadataAddress, "Stream NFT Metadata");
  await assertAccountExists(expectedStream.recipientStreamNftAta, "Recipient Stream NFT ATA");

  // Assert the contents of the Stream Data account
  const actualStreamData = await fetchStreamData(salt);
  assertEqStreamData(actualStreamData, expectedStream.data);

  // Assert that the Stream NFT Mint has the correct total supply
  const streamNftMintTotalSupply = await getMintTotalSupplyOf(banksClient, expectedStream.nftMintAddress);
  assertEqualBn(streamNftMintTotalSupply, BN_1, "Stream NFT Mint total supply not 1");

  // Assert that the Recipient's Stream NFT ATA has the correct balance
  const recipientStreamNftBalance = await getATABalance(banksClient, expectedStream.recipientStreamNftAta);
  assertEqualBn(recipientStreamNftBalance, BN_1, "Stream NFT not minted");

  // TODO: test that the Stream NFT has been properly added to the LL NFT collection

  // Assert that the Sender's balance has changed correctly
  const expectedTokenBalance = beforeSenderTokenBalance.sub(Amount.DEPOSIT);
  const afterSenderTokenBalance = await getSenderTokenBalance(expectedStream.data.depositedTokenMint);
  assertEqualBn(expectedTokenBalance, afterSenderTokenBalance, "sender balance not updated correctly");
}
