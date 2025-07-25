import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import dayjs from "dayjs";
import { ZERO } from "../../../lib/constants";
import { sol, usdc } from "../../../lib/helpers";
import type { Amounts, Timestamps, UnlockAmounts } from "./types";

export namespace Amount {
  export const CLIFF = usdc("2500.000001");
  export const DEPOSIT = usdc(10_000);
  export const START = ZERO;
  export const WITHDRAW_FEE = sol("0.01");

  export const WITHDRAW = usdc(2600);
  export const REFUND = DEPOSIT.sub(WITHDRAW);
}

export namespace ProgramId {
  export const TOKEN_2022 = TOKEN_2022_PROGRAM_ID;
  export const TOKEN_METADATA = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  export const TOKEN = TOKEN_PROGRAM_ID;
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
  export const GENESIS = new BN(dayjs().add(1, "day").unix()); // tomorrow
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
