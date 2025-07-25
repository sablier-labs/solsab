import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

/* -------------------------------------------------------------------------- */
/*                                PROGRAM TYPES                               */
/* -------------------------------------------------------------------------- */

/**
 * Must correspond to the analogous Rust type.
 * @see {@link file://./../../../programs/merkle_instant/src/state/campaign.rs}
 */
export type CampaignData = {
  airdropTokenMint: PublicKey;
  creator: PublicKey;
  expirationTime: BN;
  firstClaimTime: BN;
  ipfsCid: string;
  merkleRoot: number[];
  name: string;
};
