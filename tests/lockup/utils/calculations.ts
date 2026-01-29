import type BN from "bn.js";
import { SCALING_FACTOR, ZERO } from "../../../lib/constants";
import type {
  Amounts,
  LinearTimestamps,
  LinearUnlockAmounts,
} from "../../../target/types/sablier_lockup_structs";

/**
 * Replicates the logic of the `get_streamed_amount` function in the Solana program for linear streams.
 * This is unused at the moment, but we keep it because it will be used in the future when we add fuzzing.
 * @see {@link file://./../../../programs/lockup/src/utils/lockup_math.rs}
 */
export function getLinearStreamedAmount(
  amounts: Amounts,
  now: BN,
  timestamps: LinearTimestamps,
  unlockAmounts: LinearUnlockAmounts,
): BN {
  if (timestamps.start.gt(now)) {
    return ZERO;
  }
  if (timestamps.cliff.gt(now)) {
    return unlockAmounts.start;
  }
  if (timestamps.end.lte(now)) {
    return amounts.deposited;
  }

  const unlockAmountsSum = unlockAmounts.start.add(unlockAmounts.cliff);
  if (unlockAmountsSum.gte(amounts.deposited)) {
    return amounts.deposited;
  }

  const streamingStartTime = timestamps.cliff.isZero() ? timestamps.start : timestamps.cliff;

  const elapsedTime = now.sub(streamingStartTime).mul(SCALING_FACTOR);
  const streamableTimeRange = timestamps.end.sub(streamingStartTime);
  const streamedPercentage = elapsedTime.div(streamableTimeRange);
  const streamableAmount = amounts.deposited.sub(unlockAmountsSum);

  const streamedPortion = streamedPercentage.mul(streamableAmount).div(SCALING_FACTOR);
  const streamedAmount = unlockAmountsSum.add(streamedPortion);
  if (streamedAmount.gt(amounts.deposited)) {
    return amounts.deposited;
  }

  return streamedAmount;
}
