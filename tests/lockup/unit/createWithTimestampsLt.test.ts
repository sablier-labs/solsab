import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ERR_ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { beforeEach, describe, it } from "vitest";
import { MAX_U64, ZERO } from "../../../lib/constants";
import { usdc } from "../../../lib/convertors";
import { toBn } from "../../../lib/helpers";
import type { Tranche } from "../../../target/types/sablier_lockup_structs";
import { getATABalance } from "../../common/anchor-bankrun";
import { LockupTestContext } from "../context";
import { assertStreamCreation, expectToThrow } from "../utils/assertions";
import {
  DEFAULT_TRANCHES,
  Time,
  TRANCHED_MODEL,
  TranchedAmounts,
  TranchedTimes,
} from "../utils/defaults";

let ctx: LockupTestContext;

describe("createWithTimestampsLt", () => {
  describe("when the program is not initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.createWithTimestampsLt({ salt: ZERO }), ERR_ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("given empty tranches array", () => {
      it("should fail", async () => {
        await expectToThrow(ctx.createWithTimestampsLt({ tranches: [] }), "TranchesArrayEmpty");
      });
    });

    describe("given non-empty tranches array", () => {
      describe("given too many tranches", () => {
        it("should fail", async () => {
          const tranches: Tranche[] = Array.from({ length: 31 }, (_, i) => ({
            amount: toBn(1),
            timestamp: Time.START.addn(i + 1),
          }));

          await expectToThrow(ctx.createWithTimestampsLt({ tranches }), "TooManyTranches");
        });
      });

      describe("given valid tranche count", () => {
        describe("given start time is zero", () => {
          it("should fail", async () => {
            await expectToThrow(ctx.createWithTimestampsLt({ startTime: ZERO }), "StartTimeZero");
          });
        });

        describe("given start time is not zero", () => {
          describe("given start time >= first tranche timestamp", () => {
            describe("when start time equals first tranche timestamp", () => {
              it("should fail", async () => {
                await expectToThrow(
                  ctx.createWithTimestampsLt({
                    startTime: TranchedTimes.TRANCHE_1,
                    tranches: DEFAULT_TRANCHES(),
                  }),
                  "StartTimeNotLessThanFirstTranche",
                );
              });
            });

            describe("when start time is greater than first tranche timestamp", () => {
              it("should fail", async () => {
                await expectToThrow(
                  ctx.createWithTimestampsLt({
                    startTime: TranchedTimes.TRANCHE_1.addn(1),
                    tranches: DEFAULT_TRANCHES(),
                  }),
                  "StartTimeNotLessThanFirstTranche",
                );
              });
            });
          });

          describe("given start time < first tranche timestamp", () => {
            describe("given tranches not in ascending order", () => {
              it("should fail", async () => {
                const tranches: Tranche[] = [
                  { amount: TranchedAmounts.TRANCHE_1, timestamp: TranchedTimes.TRANCHE_2 },
                  { amount: TranchedAmounts.TRANCHE_2, timestamp: TranchedTimes.TRANCHE_1 },
                  { amount: TranchedAmounts.TRANCHE_3, timestamp: TranchedTimes.TRANCHE_3 },
                ];

                await expectToThrow(ctx.createWithTimestampsLt({ tranches }), "TranchesNotSorted");
              });
            });

            describe("given tranches in ascending order", () => {
              describe("given a tranche with zero amount", () => {
                it("should fail", async () => {
                  const tranches: Tranche[] = [
                    { amount: TranchedAmounts.TRANCHE_1, timestamp: TranchedTimes.TRANCHE_1 },
                    { amount: ZERO, timestamp: TranchedTimes.TRANCHE_2 },
                    { amount: TranchedAmounts.TRANCHE_3, timestamp: TranchedTimes.TRANCHE_3 },
                  ];

                  await expectToThrow(
                    ctx.createWithTimestampsLt({ tranches }),
                    "TrancheAmountZero",
                  );
                });
              });

              describe("given all tranche amounts not zero", () => {
                describe("given tranche amounts sum overflow", () => {
                  it("should fail", async () => {
                    const tranches: Tranche[] = [
                      { amount: MAX_U64, timestamp: TranchedTimes.TRANCHE_1 },
                      { amount: toBn(1), timestamp: TranchedTimes.TRANCHE_2 },
                    ];

                    await expectToThrow(
                      ctx.createWithTimestampsLt({ tranches }),
                      "TrancheAmountsSumOverflow",
                    );
                  });
                });

                describe("given tranche amounts sum does not overflow", () => {
                  describe("when sender lacks an ATA for deposited token", () => {
                    it("should fail", async () => {
                      await expectToThrow(
                        ctx.createWithTimestampsLt({
                          depositTokenMint: ctx.randomToken,
                        }),
                        ERR_ACCOUNT_NOT_INITIALIZED,
                      );
                    });
                  });

                  describe("when sender has an ATA for deposited token", () => {
                    describe("when sender has insufficient token balance", () => {
                      it("should fail", async () => {
                        const tranches: Tranche[] = [
                          { amount: usdc(1_000_000).addn(1), timestamp: TranchedTimes.TRANCHE_1 },
                        ];

                        await expectToThrow(ctx.createWithTimestampsLt({ tranches }), 0x1);
                      });
                    });

                    describe("when sender has sufficient token balance", () => {
                      describe("given single tranche", () => {
                        it("should create the stream", async () => {
                          const beforeSenderTokenBalance = await getATABalance(
                            ctx.banksClient,
                            ctx.sender.usdcATA,
                          );
                          const beforeCollectionSize = await ctx.getStreamNftCollectionSize();

                          const singleTranche: Tranche[] = [
                            { amount: TranchedAmounts.DEPOSIT, timestamp: TranchedTimes.TRANCHE_1 },
                          ];

                          const salt = await ctx.createWithTimestampsLt({
                            tranches: singleTranche,
                          });

                          const expectedStream = ctx.defaultTranchedStream({
                            model: TRANCHED_MODEL({
                              timestamps: { end: TranchedTimes.TRANCHE_1 },
                              tranches: singleTranche,
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

                      describe("given multiple tranches (3)", () => {
                        describe("given SPL token", () => {
                          it("should create the stream", async () => {
                            const beforeSenderTokenBalance = await getATABalance(
                              ctx.banksClient,
                              ctx.sender.usdcATA,
                            );
                            const beforeCollectionSize = await ctx.getStreamNftCollectionSize();

                            const salt = await ctx.createWithTimestampsLt();

                            await assertStreamCreation(
                              ctx,
                              salt,
                              beforeCollectionSize,
                              beforeSenderTokenBalance,
                              ctx.defaultTranchedStream({ salt }),
                            );
                          });
                        });

                        describe("given Token2022", () => {
                          it("should create the stream", async () => {
                            const beforeSenderTokenBalance = await ctx.getSenderTokenBalance(
                              ctx.dai,
                            );
                            const beforeCollectionSize = await ctx.getStreamNftCollectionSize();

                            const salt = await ctx.createWithTimestampsLtToken2022();

                            await assertStreamCreation(
                              ctx,
                              salt,
                              beforeCollectionSize,
                              beforeSenderTokenBalance,
                              ctx.defaultTranchedStreamToken2022({ salt }),
                            );
                          });
                        });
                      });

                      describe("given start time in the past", () => {
                        it("should create the stream", async () => {
                          await ctx.timeTravelTo(Time.START.addn(500));

                          const beforeSenderTokenBalance = await getATABalance(
                            ctx.banksClient,
                            ctx.sender.usdcATA,
                          );
                          const beforeCollectionSize = await ctx.getStreamNftCollectionSize();

                          const salt = await ctx.createWithTimestampsLt();

                          await assertStreamCreation(
                            ctx,
                            salt,
                            beforeCollectionSize,
                            beforeSenderTokenBalance,
                            ctx.defaultTranchedStream({ salt }),
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
