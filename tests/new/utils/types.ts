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
  assetMint?: PublicKey;
  depositAmount?: BN;
  depositTokenProgram?: PublicKey;
  isCancelable?: boolean;
  recipientPubKey?: PublicKey;
  senderPubKey?: PublicKey;
  timestamps?: Timestamps;
  unlockAmounts?: UnlockAmounts;
}

export interface Timestamps {
  cliff: BN;
  end: BN;
  start: BN;
}

export interface StreamData {
  amounts: Amounts;
  assetMint: PublicKey;
  salt: BN;
  nftId: BN;
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
  nonCancelableStream: BN;
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
