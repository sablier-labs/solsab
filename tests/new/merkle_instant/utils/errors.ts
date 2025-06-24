import {
  getErrorCode as getErrorCodeBase,
  getErrorName as getErrorNameBase,
} from "../../common-base";

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
  AccountNotInitialized: 0xbc4,
  ConstraintAddress: 0x7dc,
} as const;
type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export function getErrorCode(errorName: string): string {
  return getErrorCodeBase(ErrorCode, errorName);
}

export function getErrorName(hexCode: string): string {
  return getErrorNameBase(ErrorCode, hexCode);
}
