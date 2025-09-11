/**
 * @file Note that this is only a type helper and is not the actual IDL. The original
 * IDL types can be found at @see {@link file://./../../../target/types/sablier_lockup_structs.ts}.
 */

import { type PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import type { StreamData } from "../../../target/types/sablier_lockup_structs";

export type Salts = {
  /* Default stream salt. */
  default: BN;
  /* The salt of a non-cancelable stream. */
  nonCancelable: BN;
  /* The salt of a stream that does not exist. */
  nonExisting: BN;
};

export const Status = {
  Canceled: "canceled",
  Depleted: "depleted",
  Pending: "pending",
  Settled: "settled",
  Streaming: "streaming",
} as const;

export type Stream = {
  data: StreamData;
  dataAddress: PublicKey;
  dataAta: PublicKey;
  nftAddress: PublicKey;
  nftCollectionAddress: PublicKey;
};

export type UnlockAmounts = {
  cliff: BN;
  start: BN;
};
