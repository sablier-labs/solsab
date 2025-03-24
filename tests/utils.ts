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

export function getDefaultMilestones(): StreamMilestones {
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

export function getMilestonesWithPastStartTime(): StreamMilestones {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
  const startTime = new anchor.BN(now - 60); // Start 1 minute ago
  const cliffTime = new anchor.BN(now + 300); // Cliff in 5 minutes
  const endTime = new anchor.BN(now + 3600); // End in 1 hour

  return {
    startTime,
    cliffTime,
    endTime,
  };
}

export function getMilestonesWithPastCliffTime(): StreamMilestones {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
  const startTime = new anchor.BN(now - 300); // Start 5 minutes ago
  const cliffTime = new anchor.BN(now - 60); // Cliff 1 minute ago
  const endTime = new anchor.BN(now + 3600); // End in 1 hour

  return {
    startTime,
    cliffTime,
    endTime,
  };
}

export function getMilestonesWithPastEndTime(): StreamMilestones {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
  const startTime = new anchor.BN(now - 3600); // Start 1 hour ago
  const cliffTime = new anchor.BN(now - 300); // Cliff 5 minutes ago
  const endTime = new anchor.BN(now - 60); // End 1 minute ago

  return {
    startTime,
    cliffTime,
    endTime,
  };
}

export function getStreamedAmountAtCancelTime(
  cancelTime: bigint,
  milestones: StreamMilestones,
  depositedAmount: anchor.BN
): anchor.BN {
  const streamedTime = new anchor.BN(cancelTime.toString()).sub(
    milestones.startTime
  );
  const totalStreamDuration = milestones.endTime.sub(milestones.startTime);
  const streamedPercentage = streamedTime.div(totalStreamDuration);
  return depositedAmount.mul(streamedPercentage);
}
