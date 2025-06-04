const ErrorCode = {
  // Collect Fees
  CantCollectZeroFees: 0x1773,

  // Clawback
  ClawbackNotAllowed: 0x1772,

  // Claim
  CampaignExpired: 0x1770,
  ClaimAmountZero: 0x177d,
  InvalidMerkleProof: 0x1771,

  // Anchor Errors
  AccountDiscriminatorMismatch: 0xbba,
  AccountNotInitialized: 0xbc4,
  AccountOwnedByWrongProgram: 0xbbf,
  ConstraintAddress: 0x7dc,
  ConstraintRaw: 0x7d3,
  ConstraintSeeds: 0x7d6,
} as const;
type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Get the hex code for a given error name
 * @param errorName The name of the error
 * @returns The hex code for the error
 */
export function getErrorCode(errorName: string): string {
  const errorCode = ErrorCode[errorName as keyof typeof ErrorCode];
  return `0x${errorCode.toString(16)}`;
}

// TODO: extract this to a common place
/**
 * Get the error name for a given hex code
 * @param hexCode The hex code of the error (e.g., "0x177e")
 * @returns The error name
 */
export function getErrorName(hexCode: string): string {
  // Convert the hex string to a number
  const numericCode = parseInt(hexCode, 16);

  // Find the error name by value
  for (const [key, value] of Object.entries(ErrorCode)) {
    // Skip numeric keys (TypeScript enums have reverse mappings)
    if (!isNaN(Number(key))) continue;

    if (value === numericCode) {
      return key;
    }
  }

  return "not found";
}
