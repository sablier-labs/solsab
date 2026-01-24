import type { BN } from "@coral-xyz/anchor";
import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
import { PublicKey } from "@solana/web3.js";
import BNjs from "bn.js";
import { beforeAll, beforeEach, describe, it } from "vitest";
import { MAX_U64, ZERO } from "../../../lib/constants";
import type { Tranche } from "../../../target/types/sablier_lockup_structs";
import { getATABalance } from "../../common/anchor-bankrun";
import { assertAccountExists, assertEqBn, assertEqPublicKey } from "../../common/assertions";
import { LockupTestContext } from "../context";
import { assertEqStreamData, expectToThrow } from "../utils/assertions";
import {
  DEFAULT_TRANCHES,
  Time,
  TRANCHED_MODEL,
  TranchedAmount,
  TranchedTime,
} from "../utils/defaults";

let ctx: LockupTestContext;

describe("createWithTimestampsLt", () => {
  describe("when the program is not initialized", () => {
    beforeAll(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup({ initProgram: false });
    });

    it("should fail", async () => {
      await expectToThrow(ctx.createWithTimestampsLt({ salt: ZERO }), ACCOUNT_NOT_INITIALIZED);
    });
  });

  describe("when the program is initialized", () => {
    beforeEach(async () => {
      ctx = new LockupTestContext();
      await ctx.setUpLockup();
    });

    describe("given tranche amount is zero", () => {
      it("should fail", async () => {
        // Individual tranche amounts are validated before summing the deposit
        await expectToThrow(
          ctx.createWithTimestampsLt({
            tranches: [{ amount: ZERO, timestamp: TranchedTime.TRANCHE_1 }],
          }),
          "TrancheAmountZero",
        );
      });
    });

    describe("given start time is zero", () => {
      it("should fail", async () => {
        await expectToThrow(
          ctx.createWithTimestampsLt({
            startTime: ZERO,
          }),
          "StartTimeZero",
        );
      });
    });

    describe("given empty tranches array", () => {
      it("should fail", async () => {
        // Empty tranches array is validated before computing deposit amount
        await expectToThrow(
          ctx.createWithTimestampsLt({
            tranches: [],
          }),
          "TranchesArrayEmpty",
        );
      });
    });

    // NOTE: Tests for MAX_TRANCHES boundary (49, 50, 51 tranches) are omitted because
    // transactions with that many tranches exceed Solana's 1232-byte transaction size limit.
    // The MAX_TRANCHES validation is tested at the Rust program level.

    describe("given start time >= first tranche timestamp", () => {
      it("should fail when start time equals first tranche timestamp", async () => {
        await expectToThrow(
          ctx.createWithTimestampsLt({
            startTime: TranchedTime.TRANCHE_1,
            tranches: DEFAULT_TRANCHES(),
          }),
          "StartTimeNotLessThanFirstTranche",
        );
      });

      it("should fail when start time is greater than first tranche timestamp", async () => {
        await expectToThrow(
          ctx.createWithTimestampsLt({
            startTime: TranchedTime.TRANCHE_1.addn(1),
            tranches: DEFAULT_TRANCHES(),
          }),
          "StartTimeNotLessThanFirstTranche",
        );
      });
    });

    describe("given tranches not in ascending order", () => {
      it("should fail", async () => {
        const tranches: Tranche[] = [
          { amount: TranchedAmount.TRANCHE_1, timestamp: TranchedTime.TRANCHE_2 },
          { amount: TranchedAmount.TRANCHE_2, timestamp: TranchedTime.TRANCHE_1 },
          { amount: TranchedAmount.TRANCHE_3, timestamp: TranchedTime.TRANCHE_3 },
        ];

        await expectToThrow(ctx.createWithTimestampsLt({ tranches }), "TranchesNotSorted");
      });
    });

    describe("given duplicate tranche timestamps", () => {
      it("should fail", async () => {
        const tranches: Tranche[] = [
          { amount: TranchedAmount.TRANCHE_1, timestamp: TranchedTime.TRANCHE_1 },
          { amount: TranchedAmount.TRANCHE_2, timestamp: TranchedTime.TRANCHE_1 },
          { amount: TranchedAmount.TRANCHE_3, timestamp: TranchedTime.TRANCHE_3 },
        ];

        await expectToThrow(ctx.createWithTimestampsLt({ tranches }), "TranchesNotSorted");
      });
    });

    describe("given tranche with zero amount", () => {
      it("should fail", async () => {
        const tranches: Tranche[] = [
          { amount: TranchedAmount.TRANCHE_1, timestamp: TranchedTime.TRANCHE_1 },
          { amount: ZERO, timestamp: TranchedTime.TRANCHE_2 },
          { amount: TranchedAmount.TRANCHE_3, timestamp: TranchedTime.TRANCHE_3 },
        ];

        await expectToThrow(ctx.createWithTimestampsLt({ tranches }), "TrancheAmountZero");
      });
    });

    describe("given tranche amounts sum overflow", () => {
      it("should fail", async () => {
        const tranches: Tranche[] = [
          { amount: MAX_U64, timestamp: TranchedTime.TRANCHE_1 },
          { amount: new BNjs(1), timestamp: TranchedTime.TRANCHE_2 },
        ];

        await expectToThrow(ctx.createWithTimestampsLt({ tranches }), "TrancheAmountsSumOverflow");
      });
    });

    describe("given valid parameters", () => {
      describe("given single tranche", () => {
        it("should create the stream", async () => {
          const beforeSenderTokenBalance = await getATABalance(ctx.banksClient, ctx.sender.usdcATA);
          const beforeCollectionSize = await ctx.getStreamNftCollectionSize();

          const singleTranche: Tranche[] = [
            { amount: TranchedAmount.DEPOSIT, timestamp: TranchedTime.TRANCHE_1 },
          ];

          const salt = await ctx.createWithTimestampsLt({ tranches: singleTranche });

          const expectedStream = ctx.defaultTranchedStream({
            model: TRANCHED_MODEL({
              timestamps: { end: TranchedTime.TRANCHE_1 },
              tranches: singleTranche,
            }),
            salt,
          });

          await assertStreamCreation(
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

            await assertStreamCreation(salt, beforeCollectionSize, beforeSenderTokenBalance);
          });
        });

        describe("given Token2022", () => {
          it("should create the stream", async () => {
            const beforeSenderTokenBalance = await ctx.getSenderTokenBalance(ctx.dai);
            const beforeCollectionSize = await ctx.getStreamNftCollectionSize();

            const salt = await ctx.createWithTimestampsLtToken2022();

            await assertStreamCreation(
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
          // Time travel to after the default start time
          await ctx.timeTravelTo(Time.START.addn(500));

          const beforeSenderTokenBalance = await getATABalance(ctx.banksClient, ctx.sender.usdcATA);
          const beforeCollectionSize = await ctx.getStreamNftCollectionSize();

          const salt = await ctx.createWithTimestampsLt();

          await assertStreamCreation(salt, beforeCollectionSize, beforeSenderTokenBalance);
        });
      });

      describe("given is_cancelable = false", () => {
        it("should create non-cancelable stream", async () => {
          const beforeSenderTokenBalance = await getATABalance(ctx.banksClient, ctx.sender.usdcATA);
          const beforeCollectionSize = await ctx.getStreamNftCollectionSize();

          const salt = await ctx.createWithTimestampsLt({ isCancelable: false });

          const expectedStream = ctx.defaultTranchedStream({
            isCancelable: false,
            salt,
          });

          await assertStreamCreation(
            salt,
            beforeCollectionSize,
            beforeSenderTokenBalance,
            expectedStream,
          );
        });
      });
    });
  });
});

async function assertStreamCreation(
  salt: BN,
  beforeCollectionSize: BN,
  beforeSenderTokenBalance: BN,
  expectedStream = ctx.defaultTranchedStream({ salt }),
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
  assertEqPublicKey(
    new PublicKey(streamNft.owner),
    recipient,
    "Stream NFT isn't owned by the recipient",
  );

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
  const expectedTokenBalance = beforeSenderTokenBalance.sub(expectedStream.data.amounts.deposited);
  const afterSenderTokenBalance = await ctx.getSenderTokenBalance(
    expectedStream.data.depositedTokenMint,
  );
  assertEqBn(expectedTokenBalance, afterSenderTokenBalance, "sender balance not updated correctly");
}
