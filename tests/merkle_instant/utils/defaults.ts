import { BN } from "@coral-xyz/anchor";

/*//////////////////////////////////////////////////////////////////////////
                                     CONSTANTS
//////////////////////////////////////////////////////////////////////////*/

// Amounts
export const AGGREGATE_AMOUNT = new BN(10_000e6);
export const CLAIM_AMOUNT = new BN(100e6);
export const CLAWBACK_AMOUNT = new BN(1_000e6);
export const CLAIM_FEE_AMOUNT = 30_000_000; // 0.01 SOL

// Timestamps
export const APR_1_2025 = new BN(1_743_454_800);
const GRACE_PERIOD_DURATION = new BN(60 * 60 * 24 * 7); // 7 days in seconds
export const TIME_AFTER_GRACE_PERIOD = APR_1_2025.add(
  GRACE_PERIOD_DURATION.add(new BN(1))
); // 7 days + 1 sec past APR_1_2025
const TEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 10;
export const EXPIRATION_TIME = APR_1_2025.add(new BN(TEN_DAYS_IN_SECONDS));

// Seeds
export const TREASURY_SEED = "treasury";
export const CAMPAIGN_SEED = "campaign";
export const CLAIM_RECEIPT_SEED = "claim_receipt";

// Miscellaneous
export const CAMPAIGN_NAME = "Default Campaign Name";
export const IPFS_CID =
  "bafkreiecpwdhvkmw4y6iihfndk7jhwjas3m5htm7nczovt6m37mucwgsrq";
