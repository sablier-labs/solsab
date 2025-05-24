import { BN } from "@coral-xyz/anchor";
import { Amounts, Timestamps } from "./types";

/// Replicates the logic of {lockup_math::get_streamed_amount} in the Solana program.
export function getStreamedAmount(
  amounts: Amounts,
  blockTimestamp: number | BN,
  timestamps: Timestamps
): BN {
  const now =
    blockTimestamp instanceof BN ? blockTimestamp : new BN(blockTimestamp);

  if (timestamps.start.gt(now)) {
    return new BN(0);
  }
  if (timestamps.cliff.gt(now)) {
    return amounts.startUnlock;
  }
  if (timestamps.end.lte(now)) {
    return amounts.deposited;
  }

  const unlockAmountsSum = amounts.startUnlock.add(amounts.cliffUnlock);
  if (unlockAmountsSum.gte(amounts.deposited)) {
    return amounts.deposited;
  }

  const streamingStartTime = amounts.cliffUnlock.isZero()
    ? timestamps.start
    : timestamps.cliff;

  const SCALING_FACTOR = new BN("1000000000000000000"); // 1e18
  const elapsedTime = now.sub(streamingStartTime).mul(SCALING_FACTOR);
  const streamableTimeRange = timestamps.end.sub(streamingStartTime);
  const streamedPercentage = elapsedTime.div(streamableTimeRange);
  const streamableAmount = amounts.deposited.sub(unlockAmountsSum);

  const streamedPortion = streamedPercentage
    .mul(streamableAmount)
    .div(SCALING_FACTOR);
  const streamedAmount = unlockAmountsSum.add(streamedPortion);
  if (streamedAmount.gt(amounts.deposited)) {
    return amounts.deposited;
  }

  return streamedAmount;
}
