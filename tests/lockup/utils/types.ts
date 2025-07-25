import { type PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

/* -------------------------------------------------------------------------- */
/*                                PROGRAM TYPES                               */
/* -------------------------------------------------------------------------- */

/**
 * Must correspond to the analogous Rust type.
 * @see {@link file://./../../../programs/lockup/src/state/lockup.rs}
 */
export type Amounts = {
  cliffUnlock: BN;
  deposited: BN;
  refunded: BN;
  startUnlock: BN;
  withdrawn: BN;
};

/**
 * Must correspond to the analogous Rust type.
 * @see {@link file://./../../../programs/lockup/src/state/lockup.rs}
 */
export type StreamData = {
  amounts: Amounts;
  depositedTokenMint: PublicKey;
  isCancelable: boolean;
  isDepleted: boolean;
  salt: BN;
  timestamps: Timestamps;
  sender: PublicKey;
  wasCanceled: boolean;
};

/**
 * Must correspond to the analogous Rust type.
 * @see {@link file://./../../../programs/lockup/src/state/lockup.rs}
 */
export type Timestamps = {
  cliff: BN;
  end: BN;
  start: BN;
};

/* -------------------------------------------------------------------------- */
/*                                 TEST TYPES                                 */
/* -------------------------------------------------------------------------- */

export type Salts = {
  /* Default stream salt. */
  default: BN;
  /* A non-cancelable stream salt. */
  nonCancelable: BN;
  /* A stream salt that does not exist. */
  nonExisting: BN;
};

export type Stream = {
  data: StreamData;
  dataAddress: PublicKey;
  dataAta: PublicKey;
  nftMasterEdition: PublicKey;
  nftMetadataAddress: PublicKey;
  nftMintAddress: PublicKey;
  recipientStreamNftAta: PublicKey;
};

export type UnlockAmounts = {
  cliff: BN;
  start: BN;
};
