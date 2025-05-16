import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
export { PublicKey } from "@solana/web3.js";

export interface Amounts {
  cliffUnlock: anchor.BN;
  deposited: anchor.BN;
  refunded: anchor.BN;
  startUnlock: anchor.BN;
  withdrawn: anchor.BN;
}

export interface CreateWithTimestampsParams {
  assetMint?: PublicKey;
  depositAmount?: anchor.BN;
  depositTokenProgram?: PublicKey;
  isCancelable?: boolean;
  recipientPubKey?: PublicKey;
  senderPubKey?: PublicKey;
  timestamps?: Timestamps;
  unlockAmounts?: UnlockAmounts;
}

export interface Timestamps {
  cliff: anchor.BN;
  end: anchor.BN;
  start: anchor.BN;
}

export interface StreamData {
  amounts: Amounts;
  assetMint: PublicKey;
  id: anchor.BN;
  isCancelable: boolean;
  isDepleted: boolean;
  timestamps: Timestamps;
  sender: PublicKey;
  wasCanceled: boolean;
}

export interface StreamIds {
  // Default stream ID.
  defaultStream: anchor.BN;
  // A non-cancelable stream ID.
  nonCancelableStream: anchor.BN;
  // A stream ID that does not exist.
  nullStream: anchor.BN;
}

export interface UnlockAmounts {
  cliff: anchor.BN;
  start: anchor.BN;
}

export interface User {
  keys: Keypair;
  daiATA: PublicKey;
  usdcATA: PublicKey;
}
