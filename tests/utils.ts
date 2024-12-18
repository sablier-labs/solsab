import { BN } from "@coral-xyz/anchor";

import { AccountInfo, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export interface StreamMilestones {
  startTime: BN;
  cliffTime: BN;
  endTime: BN;
}

// Helper to create a default AccountInfo with 100 SOL
export function getDefaultAccountInfoWithSOL(): AccountInfo<Uint8Array> {
  return {
    lamports: 100 * LAMPORTS_PER_SOL, // Default balance (100 SOL)
    owner: new PublicKey("11111111111111111111111111111111"), // Default owner (System Program)
    executable: false, // Not a program account
    rentEpoch: 0, // Default rent epoch
    data: new Uint8Array(), // Empty data
  };
}

export function generateStandardStreamMilestones(): StreamMilestones {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
  const startTime = new BN(now + 60); // Start in 1 minute
  const cliffTime = new BN(now + 300); // Cliff in 5 minutes
  const endTime = new BN(now + 3600); // End in 1 hour

  return {
    startTime,
    cliffTime,
    endTime,
  };
}
