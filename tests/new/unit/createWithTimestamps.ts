import { BN } from "@coral-xyz/anchor";

import {
  assert,
  assertErrorHexCode,
  assertErrorContains,
  assertEqStreamDatas,
} from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";
import {
  accountExists,
  banksClient,
  createWithTimestamps,
  createWithTimestampsToken2022,
  dai,
  defaultStream,
  defaultStreamToken2022,
  fetchStreamData,
  getATABalance,
  getCreatorTokenBalance,
  getMintTotalSupplyOf,
  randomToken,
  setUp,
} from "../base";

describe("createWithTimestamps", () => {
  context("when the program is not initialized", () => {
    before(async () => {
      await setUp(false);
    });

    it("should revert", async () => {
      try {
        await createWithTimestamps();
      } catch (error) {
        assertErrorContains(
          error,
          defaults.PROGRAM_NOT_INITIALIZED_ERR.CreateWithTimestamps
        );
      }
    });
  });

  context("when the program is initialized", () => {
    beforeEach(async () => {
      await setUp();
    });

    context("when deposit amount is zero", () => {
      it("should revert", async () => {
        try {
          await createWithTimestamps({ depositAmount: defaults.ZERO_BN });
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("DepositAmountZero"));
        }
      });
    });

    context("when deposit amount is not zero", () => {
      context("when start time is zero", () => {
        it("should revert", async () => {
          try {
            await createWithTimestamps({
              timestamps: { ...defaults.timestamps(), start: defaults.ZERO_BN },
            });
          } catch (error) {
            assertErrorHexCode(error, getErrorCode("StartTimeNotPositive"));
          }
        });
      });

      context("when start time is not zero", () => {
        context("when start time is negative", () => {
          it("should revert", async () => {
            try {
              await createWithTimestamps({
                timestamps: {
                  ...defaults.timestamps(),
                  start: defaults.ZERO_BN.sub(new BN(1)),
                },
              });
            } catch (error) {
              assertErrorHexCode(error, getErrorCode("StartTimeNotPositive"));
            }
          });
        });

        context("when start time is positive", () => {
          context("when sender lacks an ATA for deposited token", () => {
            it("should revert", async () => {
              try {
                await createWithTimestamps({
                  depositTokenMint: randomToken,
                });
              } catch (error) {
                assertErrorHexCode(
                  error,
                  getErrorCode("AccountNotInitialized")
                );
              }
            });
          });

          context("when sender has an ATA for deposited token", () => {
            context("when sender has an insufficient token balance", () => {
              it("should revert", async () => {
                try {
                  await createWithTimestamps({
                    depositAmount: new BN(defaults.USDC_USER_BALANCE + 1),
                  });
                } catch (error) {
                  assertErrorHexCode(error, "0x1");
                }
              });
            });

            context("when sender has a sufficient token balance", () => {
              context("when cliff time zero", () => {
                context("when cliff unlock amount not zero", () => {
                  it("should revert", async () => {
                    try {
                      await createWithTimestamps({
                        timestamps: {
                          ...defaults.timestamps(),
                          cliff: new BN(0),
                        },
                        unlockAmounts: {
                          ...defaults.unlockAmounts(),
                          cliff: new BN(1000),
                        },
                      });
                    } catch (error) {
                      assertErrorHexCode(
                        error,
                        getErrorCode("CliffTimeZeroUnlockAmountNotZero")
                      );
                    }
                  });
                });

                context("when start time not less than end time", () => {
                  it("should revert", async () => {
                    try {
                      await createWithTimestamps({
                        timestamps: {
                          ...defaults.timestamps(),
                          start: defaults.timestamps().end,
                          cliff: defaults.ZERO_BN,
                        },
                      });
                    } catch (error) {
                      assertErrorHexCode(
                        error,
                        getErrorCode("StartTimeNotLessThanEndTime")
                      );
                    }
                  });
                });

                context("when start time less than end time", () => {
                  it("should create the stream", async () => {
                    const beforeCreatorTokenBalance =
                      await getCreatorTokenBalance();

                    const salt = await createWithTimestamps({
                      timestamps: {
                        ...defaults.timestamps(),
                        cliff: defaults.ZERO_BN,
                      },
                      unlockAmounts: defaults.unlockAmountsZero(),
                    });

                    const expectedStream = defaultStream({
                      salt: salt,
                    });
                    expectedStream.data.timestamps.cliff = new BN(0);
                    expectedStream.data.amounts =
                      defaults.amountsAfterCreateWithZeroUnlocks();

                    await assertStreamCreation(
                      salt,
                      beforeCreatorTokenBalance,
                      expectedStream
                    );
                  });
                });
              });

              context("when cliff time not zero", () => {
                context("when start time not less than cliff time", () => {
                  it("should revert", async () => {
                    try {
                      await createWithTimestamps({
                        timestamps: {
                          ...defaults.timestamps(),
                          start: defaults.timestamps().cliff,
                        },
                      });
                    } catch (error) {
                      assertErrorHexCode(
                        error,
                        getErrorCode("StartTimeNotLessThanCliffTime")
                      );
                    }
                  });
                });

                context("when start time less than cliff time", () => {
                  context("when cliff time not less than end time", () => {
                    it("should revert", async () => {
                      try {
                        await createWithTimestamps({
                          timestamps: {
                            ...defaults.timestamps(),
                            cliff: defaults.timestamps().end,
                          },
                        });
                      } catch (error) {
                        assertErrorHexCode(
                          error,
                          getErrorCode("CliffTimeNotLessThanEndTime")
                        );
                      }
                    });
                  });

                  context("when cliff time less than end time", () => {
                    context(
                      "when unlock amounts sum exceeds deposit amount",
                      () => {
                        it("should revert", async () => {
                          try {
                            const depositAmount = new BN(1000);
                            await createWithTimestamps({
                              unlockAmounts: {
                                start: depositAmount,
                                cliff: depositAmount,
                              },
                              depositAmount,
                            });
                          } catch (error) {
                            assertErrorHexCode(
                              error,
                              getErrorCode("UnlockAmountsSumTooHigh")
                            );
                          }
                        });
                      }
                    );

                    context(
                      "when unlock amounts sum not exceed deposit amount",
                      () => {
                        context("when token SPL standard", () => {
                          it("should create the stream", async () => {
                            const beforeCreatorTokenBalance =
                              await getCreatorTokenBalance();

                            const salt = await createWithTimestamps();

                            await assertStreamCreation(
                              salt,
                              beforeCreatorTokenBalance
                            );
                          });
                        });

                        context("when token 2022 standard", () => {
                          it("should create the stream", async () => {
                            const beforeCreatorTokenBalance =
                              await getCreatorTokenBalance(dai);
                            const salt = await createWithTimestampsToken2022();

                            await assertStreamCreation(
                              salt,
                              beforeCreatorTokenBalance,
                              defaultStreamToken2022({ salt: salt })
                            );
                          });
                        });
                      }
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

async function assertStreamCreation(
  salt: BN,
  beforeCreatorTokenBalance: BN,
  expectedStream = defaultStream({ salt: salt })
) {
  // Assert that the Stream NFT Mint has been created
  assert(
    await accountExists(expectedStream.nftMintAddress),
    "Stream NFT Mint address not initialized"
  );
  // Assert that the Stream Data has been created
  assert(
    await accountExists(expectedStream.dataAddress),
    "Stream Data address not initialized"
  );
  // Assert that the Stream Data ATA has been created
  assert(
    await accountExists(expectedStream.dataAta),
    "Stream Data ATA address not initialized"
  );
  // Assert that the Stream NFT Master Edition has been created
  assert(
    await accountExists(expectedStream.nftMasterEdition),
    "Stream NFT Master Edition address not initialized"
  );
  // Assert that the Stream NFT Metadata has been created
  assert(
    await accountExists(expectedStream.nftMetadataAddress),
    "Stream NFT Metadata address not initialized"
  );
  // Assert that the Recipient's Stream NFT ATA has been created
  assert(
    await accountExists(expectedStream.recipientStreamNftAta),
    "Recipient Stream NFT ATA address not initialized"
  );

  // Assert the contents of the Stream Data account
  const actualStreamData = await fetchStreamData(salt);
  assertEqStreamDatas(actualStreamData, expectedStream.data);

  // Assert that the Stream NFT Mint has the correct total supply
  const streamNftMintTotalSupply = await getMintTotalSupplyOf(
    banksClient,
    expectedStream.nftMintAddress
  );
  assert(
    streamNftMintTotalSupply.eq(new BN(1)),
    "Stream NFT Mint total supply not 1"
  );

  // Assert that the Recipient's Stream NFT ATA has the correct balance
  const recipientStreamNftBalance = await getATABalance(
    banksClient,
    expectedStream.recipientStreamNftAta
  );
  assert(recipientStreamNftBalance.eq(new BN(1)), "Stream NFT not minted");

  // TODO: assert that the Stream NFT has been properly added to the LL NFT collection

  // Assert that the Creator's balance has changed correctly
  const expectedTokenBalance = beforeCreatorTokenBalance.sub(
    defaults.DEPOSIT_AMOUNT
  );
  const afterCreatorTokenBalance = await getCreatorTokenBalance(
    expectedStream.data.depositedTokenMint
  );
  assert(
    expectedTokenBalance.eq(afterCreatorTokenBalance),
    "Creator's balance not updated correctly"
  );
}
