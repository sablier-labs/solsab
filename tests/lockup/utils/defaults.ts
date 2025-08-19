import BN from "bn.js";
import { ZERO } from "../../../lib/constants";
import { usdc } from "../../../lib/convertors";
import type { Amounts, Timestamps } from "../../../target/types/sablier_lockup_structs";
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
  export const EDITION = Buffer.from("edition");
  export const METADATA = Buffer.from("metadata");
  export const NFT_COLLECTION_DATA = Buffer.from("nft_collection_data");
  export const NFT_COLLECTION_MINT = Buffer.from("nft_collection_mint");
  export const STREAM_DATA = Buffer.from("stream_data");
  export const STREAM_NFT_MINT = Buffer.from("stream_nft_mint");
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

export function AMOUNTS({
  cliffUnlock = Amount.CLIFF,
  deposited = Amount.DEPOSIT,
  refunded = ZERO,
  startUnlock = Amount.START,
  withdrawn = ZERO,
}: Partial<Amounts> = {}): Amounts {
  return {
    cliffUnlock,
    deposited,
    refunded,
    startUnlock,
    withdrawn,
  };
}

export function TIMESTAMPS({
  cliff = Time.CLIFF,
  end = Time.END,
  start = Time.START,
}: Partial<Timestamps> = {}): Timestamps {
  return {
    cliff,
    end,
    start,
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
