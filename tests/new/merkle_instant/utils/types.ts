import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

export interface CampaignData {
  airdropTokenMint: PublicKey;
  creator: PublicKey;
  expirationTime: BN;
  firstClaimTime: BN;
  ipfsCid: string;
  merkleRoot: number[];
  name: string;
}

export interface CampaignIds {
  // The ID of the default/SPL campaign.
  default: PublicKey;
  // The ID of a Token2022 campaign.
  token2022: PublicKey;
  // The ID of a campaign that doesn't exist.
  nonExisting: PublicKey;
}

export interface User {
  keys: Keypair;
  daiATA: PublicKey;
  usdcATA: PublicKey;
}
