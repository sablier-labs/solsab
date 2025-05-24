const ErrorCode = {
  // Cancel Stream
  StreamCanceled: 0x1770,
  StreamIsNotCancelable: 0x1771,
  StreamSettled: 0x1772,

  // Collect Fees
  CantCollectZeroFees: 0x1773,

  // Create Stream
  CliffTimeZeroUnlockAmountNotZero: 0x1774,
  CliffTimeNotLessThanEndTime: 0x1775,
  DepositAmountZero: 0x1776,
  StartTimeNotPositive: 0x1777,
  StartTimeNotLessThanCliffTime: 0x1778,
  StartTimeNotLessThanEndTime: 0x1779,
  UnlockAmountsSumTooHigh: 0x177a,

  // Renounce
  StreamAlreadyNonCancelable: 0x177b,

  // Withdraw
  Overdraw: 0x177c,
  WithdrawAmountZero: 0x177d,

  // Common
  StreamDepleted: 0x177e,

  // Anchor Errors
  AccountNotInitialized: 0xbc4,
  ConstraintAddress: 0x7dc,
  ConstraintRaw: 0x7d3,
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
