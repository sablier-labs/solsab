import * as anchor from "@coral-xyz/anchor";

import web3 from "@solana/web3.js";

export interface StreamMilestones {
  startTime: anchor.BN;
  cliffTime: anchor.BN;
  endTime: anchor.BN;
}

// Helper to create a default AccountInfo with 100 SOL
export function getDefaultAccountInfoWithSOL(): web3.AccountInfo<Uint8Array> {
  return {
    lamports: 100 * web3.LAMPORTS_PER_SOL, // Default balance (100 SOL)
    owner: new web3.PublicKey("11111111111111111111111111111111"), // Default owner (System Program)
    executable: false, // Not a program account
    rentEpoch: 0, // Default rent epoch
    data: new Uint8Array(), // Empty data
  };
}

export function generateStandardStreamMilestones(): StreamMilestones {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
  const startTime = new anchor.BN(now + 60); // Start in 1 minute
  const cliffTime = new anchor.BN(now + 300); // Cliff in 5 minutes
  const endTime = new anchor.BN(now + 3600); // End in 1 hour

  return {
    startTime,
    cliffTime,
    endTime,
  };
}
