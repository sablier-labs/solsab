import type BN from "bn.js";
import { ZERO } from "../../../lib/constants";
import { usdc } from "../../../lib/convertors";
import { toBn } from "../../../lib/helpers";
import type {
  Amounts,
  LinearTimestamps,
  LinearUnlockAmounts,
  StreamModel,
  Tranche,
  TranchedTimestamps,
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
  export const CLIFF_DURATION = toBn(2500);
  // We use this fixed timestamp to ensure that the mock Chainlink data is not outdated.
  export const GENESIS = toBn(1754142441); // August 2, 2025 1:47:21 PM
  export const START = GENESIS.add(toBn(1000));
  export const TOTAL_DURATION = toBn(10_000);

  export const CLIFF = START.add(CLIFF_DURATION);
  export const END = START.add(TOTAL_DURATION);
  export const MID_26_PERCENT = START.add(toBn(2600));
}

/*//////////////////////////////////////////////////////////////////////////
                              TRANCHED DEFAULTS
//////////////////////////////////////////////////////////////////////////*/

export namespace TranchedAmounts {
  export const TRANCHE_1 = usdc(2000);
  export const TRANCHE_2 = usdc(3000);
  export const TRANCHE_3 = usdc(5000);
  export const DEPOSIT = TRANCHE_1.add(TRANCHE_2).add(TRANCHE_3); // 10,000

  // Amount streamed after tranches 1 and 2 unlock
  export const STREAMED_AFTER_T2 = TRANCHE_1.add(TRANCHE_2);
}

/**
 * Tranche durations.
 */
export namespace TranchedDurations {
  export const TRANCHE_1 = toBn(2000); // offset from start
  export const TRANCHE_2 = toBn(2000); // offset from tranche 1
  export const TRANCHE_3 = toBn(6000); // offset from tranche 2
}

/**
 * Absolute tranche timestamps (derived from cumulative durations).
 */
export namespace TranchedTimes {
  export const TRANCHE_1 = Time.START.add(TranchedDurations.TRANCHE_1); // start + 2000
  export const TRANCHE_2 = TRANCHE_1.add(TranchedDurations.TRANCHE_2); // T1 + 2000
  export const TRANCHE_3 = TRANCHE_2.add(TranchedDurations.TRANCHE_3); // T2 + 6000
  export const MID_TRANCHE_1_2 = TRANCHE_1.add(TranchedDurations.TRANCHE_2.divn(2)); // Between T1 and T2
  export const END = TRANCHE_3; // Alias for clarity
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

/*//////////////////////////////////////////////////////////////////////////
                           TRANCHED FACTORY FUNCTIONS
//////////////////////////////////////////////////////////////////////////*/

export function TRANCHED_AMOUNTS({
  deposited = TranchedAmounts.DEPOSIT,
  refunded = ZERO,
  withdrawn = ZERO,
}: Partial<Amounts> = {}): Amounts {
  return {
    deposited,
    refunded,
    withdrawn,
  };
}

export function TRANCHED_TIMESTAMPS({
  start = Time.START,
  end = TranchedTimes.END,
}: Partial<TranchedTimestamps> = {}): TranchedTimestamps {
  return {
    end,
    start,
  };
}

export function DEFAULT_TRANCHES({
  tranche1Amount = TranchedAmounts.TRANCHE_1,
  tranche2Amount = TranchedAmounts.TRANCHE_2,
  tranche3Amount = TranchedAmounts.TRANCHE_3,
  tranche1Timestamp = TranchedTimes.TRANCHE_1,
  tranche2Timestamp = TranchedTimes.TRANCHE_2,
  tranche3Timestamp = TranchedTimes.TRANCHE_3,
}: {
  tranche1Amount?: BN;
  tranche2Amount?: BN;
  tranche3Amount?: BN;
  tranche1Timestamp?: BN;
  tranche2Timestamp?: BN;
  tranche3Timestamp?: BN;
} = {}): Tranche[] {
  return [
    { amount: tranche1Amount, timestamp: tranche1Timestamp },
    { amount: tranche2Amount, timestamp: tranche2Timestamp },
    { amount: tranche3Amount, timestamp: tranche3Timestamp },
  ];
}

export function TRANCHED_MODEL({
  timestamps: timestampOverrides,
  tranches,
}: {
  timestamps?: Partial<TranchedTimestamps>;
  tranches?: Tranche[];
} = {}): StreamModel {
  return {
    tranched: {
      timestamps: TRANCHED_TIMESTAMPS(timestampOverrides),
      tranches: tranches ?? DEFAULT_TRANCHES(),
    },
  };
}
