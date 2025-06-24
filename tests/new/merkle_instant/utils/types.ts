import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export interface CampaignData {
  airdropTokenMint: PublicKey;
  creator: PublicKey;
  expirationTime: BN;
  firstClaimTime: BN;
  ipfsId: string;
  merkleRoot: number[];
  name: string;
}
