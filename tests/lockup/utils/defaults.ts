import { BN } from "@coral-xyz/anchor";
import { ZERO } from "../../../lib/constants";
import { usdc } from "../../../lib/convertors";
import type {
  Amounts,
  LinearTimestamps,
  LinearUnlockAmounts,
  StreamModel,
} from "../../../target/types/sablier_lockup_structs";
import type { UnlockAmounts } from "./types";

export namespace Amount {
  export const CLIFF = usdc("2500.000001");
  export const DEPOSIT = usdc(10_000);
  export const START = ZERO;
  export const STREAMED_26_PERCENT = usdc(2600);
  export const WITHDRAW = usdc(2600);
  export const REFUND = DEPOSIT.sub(WITHDRAW);
}

export namespace Seed {
  export const STREAM_DATA = Buffer.from("stream_data");
  export const STREAM_NFT = Buffer.from("stream_nft");
  export const STREAM_NFT_COLLECTION = Buffer.from("stream_nft_collection");
  export const TREASURY = Buffer.from("treasury");
}

/**
 * All timestamps and durations are in seconds.
 */
export namespace Time {
  export const CLIFF_DURATION = new BN(2500);
  // We use this fixed timestamp to ensure that the mock Chainlink data is not outdated.
  export const GENESIS = new BN(1754142441); // August 2, 2025 1:47:21 PM
  export const START = GENESIS.add(new BN(1000));
  export const TOTAL_DURATION = new BN(10_000);

  export const CLIFF = START.add(CLIFF_DURATION);
  export const END = START.add(TOTAL_DURATION);
  export const MID_26_PERCENT = START.add(new BN(2600));
}

/**
 * These are written as functions so that the fields can be updated in each test.
 */

export function LINEAR_AMOUNTS({
  deposited = Amount.DEPOSIT,
  refunded = ZERO,
  withdrawn = ZERO,
}: Partial<Amounts> = {}): Amounts {
  return {
    deposited,
    refunded,
    withdrawn,
  };
}

export function LINEAR_TIMESTAMPS({
  cliff = Time.CLIFF,
  end = Time.END,
  start = Time.START,
}: Partial<LinearTimestamps> = {}): LinearTimestamps {
  return {
    cliff,
    end,
    start,
  };
}

export function LINEAR_UNLOCK_AMOUNTS({
  cliff = Amount.CLIFF,
  start = Amount.START,
}: Partial<LinearUnlockAmounts> = {}): LinearUnlockAmounts {
  return {
    cliff,
    start,
  };
}

export function LINEAR_MODEL({
  timestamps: timestampOverrides,
  unlockAmounts: unlockAmountsOverrides,
}: {
  timestamps?: Partial<LinearTimestamps>;
  unlockAmounts?: Partial<LinearUnlockAmounts>;
} = {}): StreamModel {
  return {
    linear: {
      timestamps: LINEAR_TIMESTAMPS(timestampOverrides),
      unlockAmounts: LINEAR_UNLOCK_AMOUNTS(unlockAmountsOverrides),
    },
  };
}

export function UNLOCK_AMOUNTS({
  cliff = Amount.CLIFF,
  start = Amount.START,
}: Partial<UnlockAmounts> = {}): UnlockAmounts {
  return {
    cliff,
    start,
  };
}
