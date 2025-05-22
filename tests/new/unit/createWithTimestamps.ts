import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

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
  defaultStreamData,
  defaultStreamDataToken2022,
  deriveATAAddress,
  fetchStreamData,
  getATABalance,
  getMintTotalSupplyOf,
  getPDAAddress,
  randomToken,
  recipient,
  sender,
  setUp,
  treasuryAddress,
  usdc,
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

    context("when deposit amount zero", () => {
      it("should revert", async () => {
        try {
          await createWithTimestamps({ depositAmount: defaults.ZERO_BN });
        } catch (error) {
          assertErrorHexCode(error, getErrorCode("DepositAmountZero"));
        }
      });
    });

    context("when deposit amount not zero", () => {
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
        context("when start time is not negative", () => {
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
                  assetMint: randomToken,
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
                    const beforeSenderTokenBalance = await getATABalance(
                      banksClient,
                      sender.usdcATA
                    );

                    const { streamId, streamNftMint } =
                      await createWithTimestamps({
                        timestamps: {
                          ...defaults.timestamps(),
                          cliff: defaults.ZERO_BN,
                        },
                        unlockAmounts: defaults.unlockAmountsZero(),
                      });

                    const expectedStreamData = defaultStreamData({
                      id: streamId,
                    });
                    expectedStreamData.timestamps.cliff = new BN(0);
                    expectedStreamData.amounts =
                      defaults.amountsAfterCreateWithZeroUnlocks();

                    const treasuryATA = deriveATAAddress(
                      usdc,
                      treasuryAddress,
                      defaults.TOKEN_PROGRAM_ID
                    );
                    await assertStreamCreation(
                      streamId,
                      streamNftMint,
                      beforeSenderTokenBalance,
                      sender.usdcATA,
                      treasuryATA,
                      expectedStreamData
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
                            const beforeSenderTokenBalance =
                              await getATABalance(banksClient, sender.usdcATA);

                            // TODO: We need to decide wether we create the ATA before or in create
                            // const beforeTreasuryTokenBalance = await getATABalance(
                            //   sender.treasuryATA
                            // );

                            const { streamId, streamNftMint } =
                              await createWithTimestamps();

                            await assertStreamCreationSPL(
                              streamId,
                              streamNftMint,
                              beforeSenderTokenBalance
                            );
                          });
                        });

                        context("when token 2022 standard", () => {
                          it("should create the stream", async () => {
                            const beforeSenderTokenBalance =
                              await getATABalance(banksClient, sender.daiATA);

                            const { streamId, streamNftMint } =
                              await createWithTimestampsToken2022();

                            await assertStreamCreationToken2022(
                              streamId,
                              streamNftMint,
                              beforeSenderTokenBalance
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

async function assertStreamCreationSPL(
  streamId: BN,
  streamNftMint: PublicKey,
  beforeSenderTokenBalance: BN
) {
  const treasuryATA = deriveATAAddress(
    usdc,
    treasuryAddress,
    defaults.TOKEN_PROGRAM_ID
  );

  await assertStreamCreation(
    streamId,
    streamNftMint,
    beforeSenderTokenBalance,
    sender.usdcATA,
    treasuryATA,
    defaultStreamData({
      id: streamId,
    })
  );
}

async function assertStreamCreationToken2022(
  streamId: BN,
  streamNftMint: PublicKey,
  beforeSenderTokenBalance: BN
) {
  const treasuryATA = deriveATAAddress(
    dai,
    treasuryAddress,
    defaults.TOKEN_2022_PROGRAM_ID
  );

  await assertStreamCreation(
    streamId,
    streamNftMint,
    beforeSenderTokenBalance,
    sender.daiATA,
    treasuryATA,
    defaultStreamDataToken2022({
      id: streamId,
    })
  );
}

async function assertStreamCreation(
  streamId: BN,
  streamNftMint: PublicKey,
  beforeSenderTokenBalance: BN,
  senderATA: PublicKey,
  treasuryATA: PublicKey,
  expectedStreamData: any
) {
  // Assert that the Treasury ATA has been created
  assert(await accountExists(treasuryATA), "Treasury ATA not initialized");

  // Assert that the Stream NFT Mint has been created
  assert(await accountExists(streamNftMint), "Stream NFT Mint not initialized");

  // Assert that the Stream NFT Mint has the correct total supply
  const streamNftMintTotalSupply = await getMintTotalSupplyOf(
    banksClient,
    streamNftMint
  );
  assert(
    streamNftMintTotalSupply.eq(new BN(1)),
    "Stream NFT Mint total supply not 1"
  );

  // Assert that the Stream NFT Metadata has been created
  const streamNftMetadata = getPDAAddress(
    [
      Buffer.from(defaults.METADATA_SEED),
      defaults.TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      streamNftMint.toBuffer(),
    ],
    defaults.TOKEN_METADATA_PROGRAM_ID
  );
  assert(
    await accountExists(streamNftMetadata),
    "Stream NFT Metadata not initialized"
  );

  // Assert that the Stream NFT Master Edition has been created
  const streamNftMasterEdition = getPDAAddress(
    [
      Buffer.from(defaults.METADATA_SEED),
      defaults.TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      streamNftMint.toBuffer(),
      Buffer.from(defaults.EDITION_SEED),
    ],
    defaults.TOKEN_METADATA_PROGRAM_ID
  );

  assert(
    await accountExists(streamNftMasterEdition),
    "Stream NFT Master Edition not initialized"
  );

  // Assert that the Recipient's Stream NFT ATA has been created
  const recipientStreamNftATA = deriveATAAddress(
    streamNftMint,
    recipient.keys.publicKey,
    defaults.TOKEN_PROGRAM_ID
  );

  assert(
    await accountExists(recipientStreamNftATA),
    "Recipient's Stream NFT ATA not initialized"
  );

  // Assert that the Recipient's Stream NFT ATA has the correct balance
  const recipientStreamNftBalance = await getATABalance(
    banksClient,
    recipientStreamNftATA
  );
  assert(recipientStreamNftBalance.eq(new BN(1)), "Stream NFT not minted");

  // TODO: assert that the Stream NFT has been properly added to the LL NFT collection

  // Assert that the Sender's balance has changed correctly
  const expectedTokenBalance = beforeSenderTokenBalance.sub(
    defaults.DEPOSIT_AMOUNT
  );

  const afterSenderTokenBalance = await getATABalance(banksClient, senderATA);
  assert(
    afterSenderTokenBalance.eq(expectedTokenBalance),
    "sender balance not updated correctly"
  );

  // Assert the contents of the Stream Data account
  const actualStreamData = await fetchStreamData(streamId);
  assertEqStreamDatas(actualStreamData, expectedStreamData);
}
