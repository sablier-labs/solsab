import type { BN } from "@coral-xyz/anchor";
import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { PublicKey } from "@solana/web3.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1000, ZERO } from "../../../lib/constants";
import { usdc } from "../../../lib/convertors";
import { getATABalance } from "../../common/anchor-bankrun";
import { assertAccountExists, assertEqBn, assertEqPublicKey } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import { AMOUNTS, Amount, TIMESTAMPS, Time, UNLOCK_AMOUNTS } from "../utils/defaults";

let ctx: LockupTestContext;

describe("createWithTimestampsLl", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.createWithTimestampsLl({ salt: ZERO }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("when deposit amount zero", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.createWithTimestampsLl({ depositAmount: ZERO }),
          "DepositAmountZero",
        );
      });
    });

    describe("when deposit amount not zero", () => {
      describe("when start time is zero", () => {
        it("should fail", async () => {
          await expectToThrow(
            ctx.createWithTimestampsLl({
              timestamps: TIMESTAMPS({ start: ZERO }),
            }),
            "StartTimeZero",
          );
        });
      });

      describe("when start time is not zero", () => {
        describe("when sender lacks an ATA for deposited token", () => {
          it("should fail", async () => {
            await expectToThrow(
              ctx.createWithTimestampsLl({
                depositTokenMint: ctx.randomToken,
              }),
              ACCOUNT_NOT_INITIALIZED,
            );
          });
        });

        describe("when sender has an ATA for deposited token", () => {
          describe("when sender has an insufficient token balance", () => {
            it("should fail", async () => {
              await expectToThrow(
                ctx.createWithTimestampsLl({
                  depositAmount: usdc(1_000_000).addn(1),
                }),
                0x1,
              );
            });
          });

          describe("when sender has a sufficient token balance", () => {
            describe("when cliff time zero", () => {
              describe("when cliff unlock amount not zero", () => {
                it("should fail", async () => {
                  await expectToThrow(
                    ctx.createWithTimestampsLl({
                      timestamps: TIMESTAMPS({ cliff: ZERO }),
                    }),
                    "CliffTimeZeroUnlockAmountNotZero",
                  );
                });
              });

              describe("when start time not less than end time", () => {
                it("should fail", async () => {
                  await expectToThrow(
                    ctx.createWithTimestampsLl({
                      timestamps: TIMESTAMPS({ cliff: ZERO, start: Time.END }),
                    }),
                    "StartTimeNotLessThanEndTime",
                  );
                });
              });

              describe("when start time less than end time", () => {
                it("should create the stream", async () => {
                  const beforeSenderTokenBalance = await getATABalance(
                    ctx.banksClient,
                    ctx.sender.usdcATA,
                  );

                  const beforeCollectionSize = await ctx.getStreamNftCollectionSize();

                  const salt = await ctx.createWithTimestampsLl({
                    timestamps: TIMESTAMPS({ cliff: ZERO }),
                    unlockAmounts: UNLOCK_AMOUNTS({ cliff: ZERO, start: ZERO }),
                  });

                  const expectedStream = ctx.defaultStream({
                    salt: salt,
                  });
                  expectedStream.data.timestamps.cliff = ZERO;
                  expectedStream.data.amounts = AMOUNTS({ cliffUnlock: ZERO, startUnlock: ZERO });

                  await assertStreamCreation(salt, beforeCollectionSize, beforeSenderTokenBalance, expectedStream);
                });
              });
            });

            describe("when cliff time not zero", () => {
              describe("when start time not less than cliff time", () => {
                it("should fail", async () => {
                  await expectToThrow(
                    ctx.createWithTimestampsLl({
                      timestamps: TIMESTAMPS({ start: Time.CLIFF }),
                    }),
                    "StartTimeNotLessThanCliffTime",
                  );
                });
              });

              describe("when start time less than cliff time", () => {
                describe("when cliff time not less than end time", () => {
                  it("should fail", async () => {
                    await expectToThrow(
                      ctx.createWithTimestampsLl({
                        timestamps: TIMESTAMPS({ cliff: Time.END }),
                      }),
                      "CliffTimeNotLessThanEndTime",
                    );
                  });
                });

                describe("when cliff time less than end time", () => {
                  describe("when unlock amounts sum exceeds deposit amount", () => {
                    it("should fail", async () => {
                      const depositAmount = BN_1000;
                      await expectToThrow(
                        ctx.createWithTimestampsLl({
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
                        const beforeSenderTokenBalance = await getATABalance(ctx.banksClient, ctx.sender.usdcATA);
                        const beforeCollectionSize = await ctx.getStreamNftCollectionSize();
                        const salt = await ctx.createWithTimestampsLl();

                        await assertStreamCreation(salt, beforeCollectionSize, beforeSenderTokenBalance);
                      });
                    });

                    describe("when token 2022 standard", () => {
                      it("should create the stream", async () => {
                        const beforeSenderTokenBalance = await ctx.getSenderTokenBalance(ctx.dai);
                        const beforeCollectionSize = await ctx.getStreamNftCollectionSize();
                        const salt = await ctx.createWithTimestampsLlToken2022();

                        await assertStreamCreation(
                          salt,
                          beforeCollectionSize,
                          beforeSenderTokenBalance,
                          ctx.defaultStreamToken2022({ salt: salt }),
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

async function assertStreamCreation(
  salt: BN,
  beforeCollectionSize: BN,
  beforeSenderTokenBalance: BN,
  expectedStream = ctx.defaultStream({ salt }),
  recipient = ctx.recipient.keys.publicKey,
) {
  // Assert that core stream accounts exist
  await assertAccountExists(ctx, expectedStream.nftAddress, "Stream NFT doesn't exist");
  await assertAccountExists(ctx, expectedStream.dataAddress, "Stream Data doesn't exist");
  await assertAccountExists(ctx, expectedStream.dataAta, "Stream Data ATA doesn't exist");

  // Assert the contents of the Stream Data account
  const actualStreamData = await ctx.fetchStreamData(salt);
  assertEqStreamData(actualStreamData, expectedStream.data);

  // Fetch the Stream NFT
  const streamNft = await ctx.fetchStreamNft(salt);

  // Assert that the Stream NFT is owned by the recipient
  assertEqPublicKey(new PublicKey(streamNft.owner), recipient, "Stream NFT isn't owned by the recipient");

  // Assert that the Update Authority of the Stream NFT isn't undefined
  if (!streamNft.updateAuthority.address) {
    throw new Error("Stream NFT update authority is undefined");
  }

  // Assert that the Stream NFT has been added to the collection
  assertEqPublicKey(
    new PublicKey(streamNft.updateAuthority.address),
    ctx.nftCollectionAddress,
    "Stream NFT isn't added to the collection",
  );

  // Assert that the collection size has increased by exactly 1
  assertEqBn(
    await ctx.getStreamNftCollectionSize(),
    beforeCollectionSize.addn(1),
    "Collection size should have increased by exactly 1",
  );

  // Assert that the Sender's balance has changed correctly
  const expectedTokenBalance = beforeSenderTokenBalance.sub(Amount.DEPOSIT);
  const afterSenderTokenBalance = await ctx.getSenderTokenBalance(
    expectedStream.data.depositedTokenMint,
  );
  assertEqBn(expectedTokenBalance, afterSenderTokenBalance, "sender balance not updated correctly");
}
