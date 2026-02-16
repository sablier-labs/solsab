import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ERR_ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { beforeEach, describe, it } from "vitest";
import { BN_1000, ZERO } from "../../../lib/constants";
import { usdc } from "../../../lib/convertors";
import { getATABalance } from "../../common/anchor-bankrun";
import { LockupTestContext } from "../context";
import { assertStreamCreation, expectToThrow } from "../utils/assertions";
import { LINEAR_MODEL, LINEAR_TIMESTAMPS, LINEAR_UNLOCK_AMOUNTS, Time } from "../utils/defaults";

let ctx: LockupTestContext;

describe("createWithTimestampsLl", () => {
  describe("when the program is not initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.createWithTimestampsLl({ salt: ZERO }), ERR_ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("when deposit amount is zero", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.createWithTimestampsLl({ depositAmount: ZERO }),
          "DepositAmountZero",
        );
      });
    });

    describe("when deposit amount is not zero", () => {
      describe("when start time is zero", () => {
        it("should fail", async () => {
          await expectToThrow(
            ctx.createWithTimestampsLl({
              timestamps: LINEAR_TIMESTAMPS({ start: ZERO }),
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
              ERR_ACCOUNT_NOT_INITIALIZED,
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
            describe("when cliff time is zero", () => {
              describe("when cliff unlock amount is not zero", () => {
                it("should fail", async () => {
                  await expectToThrow(
                    ctx.createWithTimestampsLl({
                      timestamps: LINEAR_TIMESTAMPS({ cliff: ZERO }),
                    }),
                    "CliffTimeZeroUnlockAmountNotZero",
                  );
                });
              });

              describe("when start time not less than end time", () => {
                it("should fail", async () => {
                  await expectToThrow(
                    ctx.createWithTimestampsLl({
                      timestamps: LINEAR_TIMESTAMPS({ cliff: ZERO, start: Time.END }),
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
                    timestamps: LINEAR_TIMESTAMPS({ cliff: ZERO }),
                    unlockAmounts: LINEAR_UNLOCK_AMOUNTS({ cliff: ZERO, start: ZERO }),
                  });

                  const expectedStream = ctx.defaultLinearStream({
                    model: LINEAR_MODEL({
                      timestamps: { cliff: ZERO },
                      unlockAmounts: { cliff: ZERO, start: ZERO },
                    }),
                    salt,
                  });

                  await assertStreamCreation(
                    ctx,
                    salt,
                    beforeCollectionSize,
                    beforeSenderTokenBalance,
                    expectedStream,
                  );
                });
              });
            });

            describe("when cliff time is not zero", () => {
              describe("when start time not less than cliff time", () => {
                it("should fail", async () => {
                  await expectToThrow(
                    ctx.createWithTimestampsLl({
                      timestamps: LINEAR_TIMESTAMPS({ start: Time.CLIFF }),
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
                        timestamps: LINEAR_TIMESTAMPS({ cliff: Time.END }),
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

                  describe("when unlock amounts sum does not exceed deposit amount", () => {
                    describe("when token SPL standard", () => {
                      it("should create the stream", async () => {
                        const beforeSenderTokenBalance = await getATABalance(
                          ctx.banksClient,
                          ctx.sender.usdcATA,
                        );
                        const beforeCollectionSize = await ctx.getStreamNftCollectionSize();
                        const salt = await ctx.createWithTimestampsLl();

                        await assertStreamCreation(
                          ctx,
                          salt,
                          beforeCollectionSize,
                          beforeSenderTokenBalance,
                          ctx.defaultLinearStream({ salt }),
                        );
                      });
                    });

                    describe("when token 2022 standard", () => {
                      it("should create the stream", async () => {
                        const beforeSenderTokenBalance = await ctx.getSenderTokenBalance(ctx.dai);
                        const beforeCollectionSize = await ctx.getStreamNftCollectionSize();
                        const salt = await ctx.createWithTimestampsLlToken2022();

                        await assertStreamCreation(
                          ctx,
                          salt,
                          beforeCollectionSize,
                          beforeSenderTokenBalance,
                          ctx.defaultLinearStreamToken2022({ salt }),
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
