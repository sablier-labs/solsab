import * as anchor from "@coral-xyz/anchor";
import web3 from "@solana/web3.js";

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

export interface UnlockAmounts {
  startUnlock: anchor.BN;
  cliffUnlock: anchor.BN;
}

export function getDefaultUnlockAmounts(): UnlockAmounts {
  return {
    startUnlock: new anchor.BN(0),
    cliffUnlock: new anchor.BN(0),
  };
}

export function getUnlockAmountsJustStart(): UnlockAmounts {
  return {
    startUnlock: new anchor.BN(100),
    cliffUnlock: new anchor.BN(0),
  };
}

export function getUnlockAmountsJustCliff(): UnlockAmounts {
  return {
    startUnlock: new anchor.BN(0),
    cliffUnlock: new anchor.BN(100),
  };
}

export function getUnlockAmountsStartAndCliff(): UnlockAmounts {
  return {
    startUnlock: new anchor.BN(100),
    cliffUnlock: new anchor.BN(100),
  };
}

export interface StreamMilestones {
  startTime: anchor.BN;
  cliffTime: anchor.BN;
  endTime: anchor.BN;
}

// TODO: use BankClient's internal clock to get the current time

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

export function getStreamedAmountAt(
  specificTime: number | anchor.BN,
  milestones: StreamMilestones,
  amounts: UnlockAmounts,
  depositedAmount: anchor.BN
): anchor.BN {
  const startTime = Number(milestones.startTime);
  const endTime = Number(milestones.endTime);
  const cliffTime = Number(milestones.cliffTime);

  // Convert the specific time to number if it is a BN.
  specificTime =
    specificTime instanceof anchor.BN ? Number(specificTime) : specificTime;

  // If the start time is in the future, return zero.
  if (startTime > specificTime) {
    return new anchor.BN(0);
  }

  // If the end time is in the past or at specificTime, return the deposited amount.
  if (endTime <= specificTime) {
    return depositedAmount;
  }

  // If the cliff time is in the future, return the start unlock amount.
  if (cliffTime > specificTime) {
    return amounts.startUnlock;
  }

  // Calculate the sum of the unlock amounts.
  const unlockAmountsSum = amounts.startUnlock.add(amounts.cliffUnlock);

  // If the sum of the unlock amounts is greater than or equal to the deposited amount,
  // return the deposited amount.
  if (unlockAmountsSum >= depositedAmount) {
    return depositedAmount;
  }

  // Determine the streaming start time.
  const streamingStartTime = amounts.cliffUnlock.eq(new anchor.BN(0))
    ? startTime
    : cliffTime;

  // Calculate the elapsed time.
  const elapsedTime = specificTime - streamingStartTime;
  const streamableTimeRange = endTime - streamingStartTime;

  // Calculate the streamed percentage as integer division.
  const streamedPercentage = elapsedTime / streamableTimeRange;

  // Calculate the streamable amount.
  const streamableAmount = Number(depositedAmount.sub(unlockAmountsSum));

  // Calculate the streamed amount.
  const streamedAmount =
    Number(unlockAmountsSum) + streamedPercentage * streamableAmount;

  // Ensure the streamed amount does not exceed the deposited amount.
  if (streamedAmount > Number(depositedAmount)) {
    return depositedAmount;
  }

  return new anchor.BN(streamedAmount);
}
