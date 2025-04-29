import { BN } from "@coral-xyz/anchor";
import {
  cancel,
  createWithTimestampsToken2022,
  defaultStreamData,
  defaultStreamDataToken2022,
  fetchStreamData,
  ids,
  sender,
  setUp,
  timeTravelTo,
  withdrawMax,
  withdraw,
  withdrawToken2022,
} from "../base";
import { assertError, assertFail, assertStreamData } from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";

describe("withdraw", () => {
  beforeEach(async () => {
    await setUp();
    // Set the time to 26% of the stream duration
    await timeTravelTo(defaults.PASS_26_PERCENT);
  });

  context("given null", () => {
    it("should revert", async () => {
      try {
        await withdraw({ streamId: ids.nullStream });
      } catch (error) {
        assertError(error, "0xbc4");
      }
    });
  });

  context("given not null", () => {
    context("given DEPLETED status", () => {
      it("should revert", async () => {
        await timeTravelTo(defaults.END_TIME);
        await withdrawMax();
        try {
          await withdraw();
        } catch (error) {
          assertError(error, getErrorCode("StreamDepleted"));
        }
      });
    });

    context("given not DEPLETED status", () => {
      context("when zero withdraw amount", () => {
        it("should revert", async () => {
          try {
            await withdraw({
              withdrawAmount: defaults.ZERO_BN,
            });
          } catch (error) {
            assertError(error, getErrorCode("WithdrawAmountZero"));
          }
        });
      });

      context("when non zero withdraw amount", () => {
        context("when withdraw amount overdraws", () => {
          it("should revert", async () => {
            try {
              await withdraw({
                withdrawAmount: defaults.WITHDRAW_AMOUNT.add(new BN(1)),
              });
            } catch (error) {
              assertError(error, getErrorCode("Overdraw"));
            }
          });
        });

        context("when withdraw amount not overdraw", () => {
          context("when withdrawal address not recipient", () => {
            context("when signer not recipient", () => {
              it("should revert", async () => {
                try {
                  await withdraw({
                    withdrawalRecipient: sender.keys.publicKey,
                  });
                  assertFail();
                } catch (error) {}
              });
            });

            context("when signer recipient", () => {
              it("should make the withdrawal", async () => {
                await withdraw({
                  withdrawalRecipient: sender.keys.publicKey,
                });
                const actualStreamData = await fetchStreamData();
                const expectedStreamData = await defaultStreamData();
                expectedStreamData.amounts.withdrawn = defaults.WITHDRAW_AMOUNT;
                assertStreamData(actualStreamData, expectedStreamData);
              });
            });
          });

          context("when withdrawal address recipient", () => {
            context("when signer unknown", () => {
              it("should make the withdrawal", async () => {
                await withdraw({ signer: sender.keys });
                const actualStreamData = await fetchStreamData();
                const expectedStreamData = await defaultStreamData();
                expectedStreamData.amounts.withdrawn = defaults.WITHDRAW_AMOUNT;
                assertStreamData(actualStreamData, expectedStreamData);
              });
            });

            context("when signer recipient", () => {
              it("should make the withdrawal", async () => {
                await withdraw();
                const actualStreamData = await fetchStreamData();
                const expectedStreamData = await defaultStreamData();
                expectedStreamData.amounts.withdrawn = defaults.WITHDRAW_AMOUNT;
                assertStreamData(actualStreamData, expectedStreamData);
              });
            });

            context("when signer sender", () => {
              context("given end time not in future", () => {
                it("should make the withdrawal", async () => {
                  await timeTravelTo(defaults.END_TIME);
                  await withdraw({
                    withdrawAmount: defaults.DEPOSIT_AMOUNT,
                    signer: sender.keys,
                  });
                  const actualStreamData = await fetchStreamData();
                  const expectedStreamData = await defaultStreamData();
                  expectedStreamData.amounts.withdrawn =
                    defaults.DEPOSIT_AMOUNT;
                  expectedStreamData.isCancelable = false;
                  expectedStreamData.isDepleted = true;
                  assertStreamData(actualStreamData, expectedStreamData);
                });
              });

              context("given end time in future", () => {
                context("given canceled stream", () => {
                  it("should make the withdrawal", async () => {
                    await cancel();

                    await withdraw({ signer: sender.keys });
                    const actualStreamData = await fetchStreamData();
                    const expectedStreamData = await defaultStreamData({
                      isCancelable: false,
                      isDepleted: true,
                      wasCanceled: true,
                    });
                    expectedStreamData.amounts.refunded =
                      defaults.REFUND_AMOUNT;
                    expectedStreamData.amounts.withdrawn =
                      defaults.WITHDRAW_AMOUNT;
                    assertStreamData(actualStreamData, expectedStreamData);
                  });
                });

                context("given not canceled stream", () => {
                  context("given token SPL standard", () => {
                    it("should make the withdrawal", async () => {
                      await withdraw({ signer: sender.keys });
                      const actualStreamData = await fetchStreamData();
                      const expectedStreamData = await defaultStreamData();
                      expectedStreamData.amounts.withdrawn =
                        defaults.WITHDRAW_AMOUNT;
                      assertStreamData(actualStreamData, expectedStreamData);
                    });
                  });

                  context("given token 2022 standard", () => {
                    it("should make the withdrawal", async () => {
                      const { streamId } =
                        await createWithTimestampsToken2022();
                      await withdrawToken2022(streamId, sender.keys);
                      const actualStreamData = await fetchStreamData(streamId);
                      const expectedStreamData =
                        await defaultStreamDataToken2022({
                          id: streamId,
                        });
                      expectedStreamData.amounts.withdrawn =
                        defaults.WITHDRAW_AMOUNT;
                      assertStreamData(actualStreamData, expectedStreamData);
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
