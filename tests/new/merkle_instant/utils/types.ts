import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

export interface CampaignData {
  airdropTokenMint: PublicKey;
  creator: PublicKey;
  expirationTime: BN;
  firstClaimTime: BN;
  ipfsId: string;
  merkleRoot: number[];
  name: string;
}

export interface User {
  keys: Keypair;
  daiATA: PublicKey;
  usdcATA: PublicKey;
}
