import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import BN from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { BN_1, BN_1000, ZERO } from "../../../lib/constants";
import { usdc } from "../../../lib/convertors";
import { getATABalance, getMintTotalSupplyOf } from "../../common/anchor-bankrun";
import { assertAccountExists, assertEqualBn } from "../../common/assertions";
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
        await expectToThrow(ctx.createWithTimestampsLl({ depositAmount: ZERO }), "DepositAmountZero");
      });
    });

    describe("when deposit amount not zero", () => {
      describe("when start time is zero", () => {
        it("should fail", async () => {
          await expectToThrow(
            ctx.createWithTimestampsLl({
              timestamps: TIMESTAMPS({ start: ZERO }),
            }),
            "StartTimeNotPositive",
          );
        });
      });

      describe("when start time is not zero", () => {
        describe("when start time is not positive", () => {
          it("should fail", async () => {
            await expectToThrow(
              ctx.createWithTimestampsLl({
                timestamps: TIMESTAMPS({ start: new BN(-1) }),
              }),
              "StartTimeNotPositive",
            );
          });
        });

        describe("when start time is positive", () => {
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
                    const beforeSenderTokenBalance = await getATABalance(ctx.banksClient, ctx.sender.usdcATA);

                    const salt = await ctx.createWithTimestampsLl({
                      timestamps: TIMESTAMPS({ cliff: ZERO }),
                      unlockAmounts: UNLOCK_AMOUNTS({ cliff: ZERO, start: ZERO }),
                    });

                    const expectedStream = ctx.defaultStream({
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
                          const salt = await ctx.createWithTimestampsLl();

                          await assertStreamCreation(salt, beforeSenderTokenBalance);
                        });
                      });

                      describe("when token 2022 standard", () => {
                        it("should create the stream", async () => {
                          const beforeSenderTokenBalance = await ctx.getSenderTokenBalance(ctx.dai);
                          const salt = await ctx.createWithTimestampsLlToken2022();

                          await assertStreamCreation(
                            salt,
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
});

async function assertStreamCreation(
  salt: BN,
  beforeSenderTokenBalance: BN,
  expectedStream = ctx.defaultStream({ salt }),
) {
  await assertAccountExists(ctx, expectedStream.nftMintAddress, "Stream NFT Mint");
  await assertAccountExists(ctx, expectedStream.dataAddress, "Stream Data");
  await assertAccountExists(ctx, expectedStream.dataAta, "Stream Data ATA");
  await assertAccountExists(ctx, expectedStream.nftMasterEdition, "Stream NFT Master Edition");
  await assertAccountExists(ctx, expectedStream.nftMetadataAddress, "Stream NFT Metadata");
  await assertAccountExists(ctx, expectedStream.recipientStreamNftAta, "Recipient Stream NFT ATA");

  // Assert the contents of the Stream Data account
  const actualStreamData = await ctx.fetchStreamData(salt);
  assertEqStreamData(actualStreamData, expectedStream.data);

  // Assert that the Stream NFT Mint has the correct total supply
  const streamNftMintTotalSupply = await getMintTotalSupplyOf(ctx.banksClient, expectedStream.nftMintAddress);
  assertEqualBn(streamNftMintTotalSupply, BN_1, "Stream NFT Mint total supply not 1");

  // Assert that the Recipient's Stream NFT ATA has the correct balance
  const recipientStreamNftBalance = await getATABalance(ctx.banksClient, expectedStream.recipientStreamNftAta);
  assertEqualBn(recipientStreamNftBalance, BN_1, "Stream NFT not minted");

  // TODO: test that the Stream NFT has been properly added to the LL NFT collection

  // Assert that the Sender's balance has changed correctly
  const expectedTokenBalance = beforeSenderTokenBalance.sub(Amount.DEPOSIT);
  const afterSenderTokenBalance = await ctx.getSenderTokenBalance(expectedStream.data.depositedTokenMint);
  assertEqualBn(expectedTokenBalance, afterSenderTokenBalance, "sender balance not updated correctly");
}
