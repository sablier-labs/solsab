import { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { assert } from "vitest";
import type { ProgramErrorName } from "../../../target/types/sablier_lockup_errors";
import { ProgramErrorCode } from "../../../target/types/sablier_lockup_errors";
import type {
  Amounts,
  LinearTimestamps,
  LinearUnlockAmounts,
  StreamData,
  StreamModel,
} from "../../../target/types/sablier_lockup_structs";
import { getATABalance, getATABalanceMint } from "../../common/anchor-bankrun";
import {
  assertAccountExists,
  assertEqBn,
  assertEqPublicKey,
  assertLteBn,
  expectToThrow as baseExpectToThrow,
} from "../../common/assertions";
import type { LockupTestContext } from "../context";
import type { Stream } from "./types";
import { isLinearModel, isTranchedModel } from "./types";

export function assertEqStreamData(a: StreamData, b: StreamData) {
  assertEqAmounts(a.amounts, b.amounts);

  // Compare model-specific data
  assertEqStreamModel(a.model, b.model);

  assertEqPublicKey(
    a.depositedTokenMint,
    b.depositedTokenMint,
    `Asset mint addresses mismatch: ${a.depositedTokenMint.toBase58()} !== ${b.depositedTokenMint.toBase58()}`,
  );
  assertEqBn(a.salt, b.salt);
  assert.equal(a.isCancelable, b.isCancelable);
  assert.equal(a.isDepleted, b.isDepleted);
  assertEqPublicKey(
    a.sender,
    b.sender,
    `Sender address mismatch: ${a.sender.toBase58()} !== ${b.sender.toBase58()}`,
  );
  assert.equal(a.wasCanceled, b.wasCanceled);
}

export function assertEqLinearTimestamps(a: LinearTimestamps, b: LinearTimestamps) {
  assertEqBn(a.cliff, b.cliff, "cliff timestamps mismatch");
  assertEqBn(a.end, b.end, "end timestamps mismatch");
  assertEqBn(a.start, b.start, "start timestamps mismatch");
}

export function assertEqLinearUnlockAmounts(a: LinearUnlockAmounts, b: LinearUnlockAmounts) {
  assertEqBn(a.cliff, b.cliff, "cliff unlock amounts mismatch");
  assertEqBn(a.start, b.start, "start unlock amounts mismatch");
}

export function expectToThrow(
  promise: Promise<unknown>,
  errorNameOrCode: ProgramErrorName | number,
) {
  return baseExpectToThrow(promise, ProgramErrorCode, errorNameOrCode);
}

export async function assertStreamCreation(
  ctx: LockupTestContext,
  salt: BN,
  beforeCollectionSize: BN,
  beforeSenderTokenBalance: BN,
  expectedStream: Stream,
  recipient: PublicKey = ctx.recipient.keys.publicKey,
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

export async function postCancelAssertions(
  ctx: LockupTestContext,
  salt: BN,
  expectedStream: Stream,
  beforeSenderBalance: BN,
) {
  // Assert that the Stream state has been updated correctly
  const actualStreamData = await ctx.fetchStreamData(salt);
  assertEqStreamData(actualStreamData, expectedStream.data);

  // Assert the Sender's ATA balance
  const afterSenderBalance = await getATABalanceMint(
    ctx.banksClient,
    expectedStream.data.sender,
    expectedStream.data.depositedTokenMint,
  );

  const actualBalanceRefunded = afterSenderBalance.sub(beforeSenderBalance);
  assertEqBn(actualBalanceRefunded, expectedStream.data.amounts.refunded);

  // Assert the StreamData ATA balance
  const actualStreamDataBalance = await getATABalanceMint(
    ctx.banksClient,
    expectedStream.dataAddress,
    expectedStream.data.depositedTokenMint,
  );
  const expectedStreamDataBalance = expectedStream.data.amounts.deposited.sub(
    expectedStream.data.amounts.refunded,
  );
  assertEqBn(actualStreamDataBalance, expectedStreamDataBalance);
}

export async function postWithdrawAssertions(
  ctx: LockupTestContext,
  salt: BN,
  txSigner: PublicKey,
  txSignerLamportsBefore: BN,
  treasuryLamportsBefore: BN,
  withdrawalRecipientATA: PublicKey,
  withdrawalRecipientATABalanceBefore: BN,
  expectedStreamData: StreamData,
  streamDataAta: PublicKey,
  streamDataAtaBalanceBefore: BN,
) {
  // Assert that the Stream state has been updated correctly
  const actualStreamData = await ctx.fetchStreamData(salt);
  assertEqStreamData(actualStreamData, expectedStreamData);

  const expectedFee = await ctx.withdrawalFeeInLamports();

  // Get the Lamports balance of the Treasury after the withdrawal
  const treasuryLamportsAfter = await ctx.getTreasuryLamports();

  // Assert that the tx signer lamports balance has decreased by, at least, the withdrawal fee amount.
  const txSignerLamportsAfter = await ctx.getLamportsOf(txSigner);
  assertLteBn(txSignerLamportsAfter, txSignerLamportsBefore.sub(expectedFee));

  // Assert that the Treasury has been credited with the withdrawal fee.
  assertEqBn(treasuryLamportsAfter, treasuryLamportsBefore.add(expectedFee));

  // Get the withdrawal recipient's token balance
  const withdrawalRecipientTokenBalance = await getATABalance(
    ctx.banksClient,
    withdrawalRecipientATA,
  );

  // Assert that the withdrawal recipient's token balance has been changed correctly
  const expectedWithdrawnAmount = expectedStreamData.amounts.withdrawn;
  assertEqBn(
    withdrawalRecipientTokenBalance,
    withdrawalRecipientATABalanceBefore.add(expectedWithdrawnAmount),
  );

  // Assert that the StreamData ATA balance has decreased by the withdrawn amount
  const streamDataAtaBalanceAfter = await getATABalance(ctx.banksClient, streamDataAta);
  assertEqBn(streamDataAtaBalanceAfter, streamDataAtaBalanceBefore.sub(expectedWithdrawnAmount));
}

/* -------------------------------------------------------------------------- */
/*                               INTERNAL LOGIC                               */
/* -------------------------------------------------------------------------- */

function assertEqAmounts(a: Amounts, b: Amounts) {
  assertEqBn(a.deposited, b.deposited, "deposited amounts mismatch");
  assertEqBn(a.refunded, b.refunded, "refunded amounts mismatch");
  assertEqBn(a.withdrawn, b.withdrawn, "withdrawn amounts mismatch");
}

function assertEqStreamModel(a: StreamModel, b: StreamModel) {
  if (isLinearModel(a) && isLinearModel(b)) {
    assertEqLinearTimestamps(a.linear.timestamps, b.linear.timestamps);
    assertEqLinearUnlockAmounts(a.linear.unlockAmounts, b.linear.unlockAmounts);
  } else if (isTranchedModel(a) && isTranchedModel(b)) {
    assertEqBn(
      a.tranched.timestamps.start,
      b.tranched.timestamps.start,
      "tranched start timestamps mismatch",
    );
    assertEqBn(
      a.tranched.timestamps.end,
      b.tranched.timestamps.end,
      "tranched end timestamps mismatch",
    );
    assert.equal(
      a.tranched.tranches.length,
      b.tranched.tranches.length,
      "tranches length mismatch",
    );
    for (let i = 0; i < a.tranched.tranches.length; i++) {
      assertEqBn(
        a.tranched.tranches[i].amount,
        b.tranched.tranches[i].amount,
        `tranche ${i} amount mismatch`,
      );
      assertEqBn(
        a.tranched.tranches[i].timestamp,
        b.tranched.tranches[i].timestamp,
        `tranche ${i} timestamp mismatch`,
      );
    }
  } else {
    assert.fail("Stream models do not match (one is Linear, other is Tranched)");
  }
}
