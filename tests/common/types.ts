import type { Keypair, PublicKey } from "@solana/web3.js";

export type User = {
  keys: Keypair;
  daiATA: PublicKey;
  usdcATA: PublicKey;
};
