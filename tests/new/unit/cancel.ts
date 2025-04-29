import { assertError, assertFail, assertStreamData } from "../utils/assertions";
import * as defaults from "../utils/defaults";
import { getErrorCode } from "../utils/errors";
import {
  cancel,
  cancelToken2022,
  createWithTimestampsToken2022,
  defaultStreamData,
  defaultStreamDataToken2022,
  eve,
  fetchStreamData,
  ids,
  recipient,
  setUp,
  timeTravelTo,
  withdrawMax,
} from "../base";

describe("cancel", () => {
  beforeEach(async () => {
    await setUp();
    // Set the time to 26% of the stream duration
    await timeTravelTo(defaults.PASS_26_PERCENT);
  });

  context("given null", () => {
    it("should revert", async () => {
      try {
        await cancel({ streamId: ids.nullStream });
      } catch (error) {
        assertError(error, "0xbc4");
      }
    });
  });

  context("given not null", () => {
    context("given cold stream", () => {
      context("given DEPLETED status", () => {
        it("should revert", async () => {
          await timeTravelTo(defaults.END_TIME);
          await withdrawMax();
          try {
            await cancel();
          } catch (error) {
            assertError(error, getErrorCode("StreamDepleted"));
          }
        });
      });

      context("given CANCELED status", () => {
        it("should revert", async () => {
          await cancel();
          try {
            await cancel();
          } catch (error) {
            assertError(error, getErrorCode("StreamCanceled"));
          }
        });
      });

      context("given SETTLED status", () => {
        it("should revert", async () => {
          await timeTravelTo(defaults.END_TIME);
          try {
            await cancel();
          } catch (error) {
            assertError(error, getErrorCode("StreamSettled"));
          }
        });
      });
    });

    context("given warm stream", () => {
      context("when signer not sender", () => {
        context("when signer malicious third party", () => {
          it("should revert", async () => {
            try {
              await cancel({ _sender: eve.keys.publicKey });
              assertFail();
            } catch (error) {}
          });
        });

        context("when signer recipient", () => {
          it("should revert", async () => {
            try {
              await cancel({ _sender: recipient.keys.publicKey });
              assertFail();
            } catch (error) {}
          });
        });
      });

      context("when signer sender", () => {
        context("given non cancelable stream", () => {
          it("should revert", async () => {
            try {
              await cancel({ streamId: ids.notCancelableStream });
            } catch (error) {
              assertError(error, getErrorCode("StreamIsNotCancelable"));
            }
          });
        });

        context("given cancelable stream", () => {
          context("given PENDING status", () => {
            it("should cancel the stream", async () => {
              // Go back in time so that the stream is PENDING
              await timeTravelTo(defaults.APR_1_2025);

              // Cancel the stream
              await cancel();

              const actualStreamData = await fetchStreamData();
              const expectedStreamData = await defaultStreamData({
                isCancelable: false,
                isDepleted: true,
                wasCanceled: true,
              });
              expectedStreamData.amounts.refunded = defaults.DEPOSIT_AMOUNT;
              assertStreamData(actualStreamData, expectedStreamData);
            });
          });

          context("given STREAMING status", () => {
            context("given token SPL standard", () => {
              it("should cancel the stream", async () => {
                // Cancel the stream
                await cancel();

                const actualStreamData = await fetchStreamData();
                const expectedStreamData = await defaultStreamData({
                  isCancelable: false,
                  wasCanceled: true,
                });
                expectedStreamData.amounts.refunded = defaults.REFUND_AMOUNT;
                assertStreamData(actualStreamData, expectedStreamData);
              });
            });

            context("given token 2022 standard", () => {
              it("should cancel the stream", async () => {
                const { streamId } = await createWithTimestampsToken2022();
                await cancelToken2022(streamId);
                const actualStreamData = await fetchStreamData(streamId);
                const expectedStreamData = await defaultStreamDataToken2022({
                  id: streamId,
                });
                expectedStreamData.amounts.refunded = defaults.REFUND_AMOUNT;
                expectedStreamData.isCancelable = false;
                expectedStreamData.wasCanceled = true;
                assertStreamData(actualStreamData, expectedStreamData);
              });
            });
          });
        });
      });
    });
  });
});
