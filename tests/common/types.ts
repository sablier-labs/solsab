import type { Keypair, PublicKey } from "@solana/web3.js";

export type User = {
  keys: Keypair;
  daiATA: PublicKey;
  usdcATA: PublicKey;
};

export type Treasury = {
  bump: number;
  chainlinkProgram: PublicKey;
  chainlinkSolUsdFeed: PublicKey;
  feeCollector: PublicKey;
};
