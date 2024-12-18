import { BN } from "@coral-xyz/anchor";

export interface StreamMilestones {
  startTime: BN;
  cliffTime: BN;
  endTime: BN;
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
