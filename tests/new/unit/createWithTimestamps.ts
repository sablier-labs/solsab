import { BN } from "@coral-xyz/anchor";
import { assert, assertError, assertStreamData } from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";
import {
  accountExists,
  createTokenMint,
  createWithTimestamps,
  createWithTimestampsToken2022,
  defaultStreamData,
  defaultStreamDataToken2022,
  deriveATAAddress,
  fetchStreamData,
  getATABalance,
  getPDAAddress,
  recipient,
  sender,
  setUp,
} from "../base";
import { PublicKey } from "../utils/types";

describe("createWithTimestamps", () => {
  beforeEach(async () => {
    await setUp();
  });

  context("when deposit amount zero", () => {
    it("should revert", async () => {
      try {
        await createWithTimestamps({ depositAmount: defaults.ZERO_BN });
      } catch (error) {
        assertError(error, getErrorCode("DepositAmountZero"));
      }
    });
  });

  context("when deposit amount not zero", () => {
    context("when start time zero", () => {
      it("should revert", async () => {
        try {
          await createWithTimestamps({
            timestamps: { ...defaults.timestamps(), start: defaults.ZERO_BN },
          });
        } catch (error) {
          assertError(error, getErrorCode("StartTimeZero"));
        }
      });
    });

    context("when start time not zero", () => {
      context("when token not contract", () => {
        it("should revert", async () => {
          try {
            await createWithTimestamps({
              assetMint: await createTokenMint(),
            });
          } catch (error) {
            assertError(error, "0xbc4");
          }
        });
      });

      context("when token contract", () => {
        context("when cliff time zero", () => {
          context("when cliff unlock amount not zero", () => {
            it("should revert", async () => {
              try {
                await createWithTimestamps({
                  timestamps: { ...defaults.timestamps(), cliff: new BN(0) },
                  unlockAmounts: {
                    ...defaults.unlockAmounts(),
                    cliff: new BN(1000),
                  },
                });
              } catch (error) {
                assertError(
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
                    start: defaults.timestamps().end.add(new BN(1)),
                  },
                });
              } catch (error) {
                assertError(error, getErrorCode("StartTimeNotLessThanEndTime"));
              }
            });
          });

          context("when start time less than end time", () => {
            it("should create the stream", async () => {
              const { streamId } = await createWithTimestamps({
                timestamps: {
                  ...defaults.timestamps(),
                  cliff: defaults.ZERO_BN,
                },
                unlockAmounts: defaults.unlockAmountsZero(),
              });

              const actualStreamData = await fetchStreamData(streamId);
              const expectedStreamData = await defaultStreamData({
                id: streamId,
              });
              expectedStreamData.timestamps.cliff = new BN(0);
              expectedStreamData.amounts = defaults.amountsAfterCreateZero();

              assertStreamData(actualStreamData, expectedStreamData);
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
                    start: defaults.timestamps().cliff.add(new BN(1)),
                  },
                });
              } catch (error) {
                assertError(
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
                      cliff: defaults.timestamps().end.add(new BN(1)),
                    },
                  });
                } catch (error) {
                  assertError(
                    error,
                    getErrorCode("CliffTimeNotLessThanEndTime")
                  );
                }
              });
            });

            context("when cliff time less than end time", () => {
              context("when unlock amounts sum exceeds deposit amount", () => {
                it("should revert", async () => {
                  try {
                    await createWithTimestamps({
                      unlockAmounts: {
                        start: new BN(5000),
                        cliff: new BN(6000),
                      },
                      depositAmount: new BN(1000),
                    });
                  } catch (error) {
                    assertError(error, getErrorCode("UnlockAmountsSumTooHigh"));
                  }
                });
              });

              context(
                "when unlock amounts sum not exceed deposit amount",
                () => {
                  context("when token SPL standard", () => {
                    it("should create the stream", async () => {
                      const beforeSenderTokenBalance = await getATABalance(
                        sender.usdcATA
                      );

                      // TODO: We need to decide wether we create the ATA before or in create
                      // const beforeTreasuryTokenBalance = await getATABalance(
                      //   sender.treasuryATA
                      // );

                      const { streamId, streamNftMint } =
                        await createWithTimestamps();

                      await assertAccounts(streamNftMint);

                      const expectedTokenBalance = (
                        await getATABalance(sender.usdcATA)
                      ).add(defaults.DEPOSIT_AMOUNT);
                      assert(
                        beforeSenderTokenBalance.eq(expectedTokenBalance),
                        "balance not updated"
                      );

                      const actualStreamData = await fetchStreamData(streamId);
                      const expectedStreamData = await defaultStreamData({
                        id: streamId,
                      });
                      assertStreamData(actualStreamData, expectedStreamData);
                    });
                  });

                  context("when token 2022 standard", () => {
                    it("should create the stream", async () => {
                      const beforeSenderTokenBalance = await getATABalance(
                        sender.daiATA
                      );

                      const { streamId, streamNftMint } =
                        await createWithTimestampsToken2022();

                      await assertAccounts(streamNftMint);

                      const expectedTokenBalance = (
                        await getATABalance(sender.daiATA)
                      ).add(defaults.DEPOSIT_AMOUNT);
                      assert(
                        beforeSenderTokenBalance.eq(expectedTokenBalance),
                        "balance not updated"
                      );

                      const actualStreamData = await fetchStreamData(streamId);
                      const expectedStreamData =
                        await defaultStreamDataToken2022({ id: streamId });
                      assertStreamData(actualStreamData, expectedStreamData);
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

async function assertAccounts(streamNftMint: PublicKey) {
  // assert(await accountExists(treasuryATA), "Treasury ATA hasn't been created");
  assert(await accountExists(streamNftMint), "Stream NFT Mint not initialized");

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

  const recipientStreamNftATA = deriveATAAddress(
    streamNftMint,
    recipient.keys.publicKey
  );

  assert(
    await accountExists(recipientStreamNftATA),
    "Recipient's Stream NFT ATA not initialized"
  );

  const recipientStreamNftBalance = await getATABalance(recipientStreamNftATA);
  assert(recipientStreamNftBalance.eq(new BN(1)), "Stream NFT not minted");
}
