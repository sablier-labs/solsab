/**
 * @file Note that this is only a type helper and is not the actual IDL. The original
 * IDL types can be found at @see {@link file://./../../../target/types/sablier_lockup_structs.ts}.
 */

import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import type { StreamData, StreamModel } from "../../../target/types/sablier_lockup_structs";

export type Salts = {
  /* Default linear (LL) stream salt. */
  defaultLl: BN;
  /* The salt of a non-cancelable linear (LL) stream. */
  nonCancelableLl: BN;
  /* The salt of a stream that does not exist. */
  nonExisting: BN;
  /* Default tranched (LT) stream salt. */
  defaultLt: BN;
  /* The salt of a non-cancelable tranched (LT) stream. */
  nonCancelableLt: BN;
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

export function isLinearModel(
  model: StreamModel,
): model is Extract<StreamModel, { linear: unknown }> {
  return "linear" in model;
}

export function isTranchedModel(
  model: StreamModel,
): model is Extract<StreamModel, { tranched: unknown }> {
  return "tranched" in model;
}
