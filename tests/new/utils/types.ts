import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
export { PublicKey } from "@solana/web3.js";

export interface Amounts {
  cliffUnlock: BN;
  deposited: BN;
  refunded: BN;
  startUnlock: BN;
  withdrawn: BN;
}

export interface CreateWithTimestampsParams {
  senderPubKey?: PublicKey;
  recipientPubKey?: PublicKey;
  assetMint?: PublicKey;
  depositTokenProgram?: PublicKey;
  timestamps?: Timestamps;
  depositAmount?: BN;
  unlockAmounts?: UnlockAmounts;
  isCancelable?: boolean;
}

export interface Timestamps {
  cliff: BN;
  end: BN;
  start: BN;
}

export interface StreamData {
  amounts: Amounts;
  assetMint: PublicKey;
  id: BN;
  isCancelable: boolean;
  isDepleted: boolean;
  timestamps: Timestamps;
  sender: PublicKey;
  wasCanceled: boolean;
}

export interface StreamIds {
  // Default stream ID.
  defaultStream: BN;
  // A non-cancelable stream ID.
  notCancelableStream: BN;
  // A stream ID that does not exist.
  nullStream: BN;
}

export interface UnlockAmounts {
  cliff: BN;
  start: BN;
}

export interface User {
  keys: Keypair;
  daiATA: PublicKey;
  usdcATA: PublicKey;
}
