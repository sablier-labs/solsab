import { BN } from "@coral-xyz/anchor";
import { Amounts, PublicKey, Timestamps, UnlockAmounts } from "./types";

/*//////////////////////////////////////////////////////////////////////////
                                     CONSTANTS
//////////////////////////////////////////////////////////////////////////*/
// Addresses
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);
export { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

// Amounts
export const DEPOSIT_AMOUNT = new BN(10_000e6);
export const STREAMED_AMOUNT_26_PERCENT = new BN(2600e6);
export const WITHDRAW_AMOUNT = STREAMED_AMOUNT_26_PERCENT;
export const REFUND_AMOUNT = DEPOSIT_AMOUNT.sub(WITHDRAW_AMOUNT);
export const CLIFF_AMOUNT = new BN(2500e6 + 1);
export const WITHDRAWAL_FEE_USD = 1;
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const ZERO_BN = new BN(0);
export const START_AMOUNT = ZERO_BN;

// Timestamps
export const APR_1_2025 = new BN(1_743_454_800);
export const START_TIME = APR_1_2025.add(new BN(1000));
export const CLIFF_DURATION = new BN(2500);
export const CLIFF_TIME = START_TIME.add(CLIFF_DURATION);
export const TOTAL_DURATION = new BN(10_000);
export const END_TIME = START_TIME.add(TOTAL_DURATION);
export const PASS_26_PERCENT = START_TIME.add(new BN(2600));

// Seeds
export const EDITION_SEED = "edition";
export const FEE_COLLECTOR_DATA_SEED = "fee_collector_data";
export const METADATA_SEED = "metadata";
export const NFT_COLLECTION_DATA_SEED = "nft_collection_data";
export const NFT_COLLECTION_MINT_SEED = "nft_collection_mint";
export const STREAM_NFT_MINT_SEED = "stream_nft_mint";
export const STREAM_DATA_SEED = "stream_data";
export const TREASURY_SEED = "treasury";

// Miscellaneous
export const PROGRAM_NOT_INITIALIZED_ERR = {
  CreateWithTimestamps: "NFT Collection Data account is undefined",
};

/*//////////////////////////////////////////////////////////////////////////
                                     PARAMETERS
//////////////////////////////////////////////////////////////////////////*/

export function amountsAfterCreate(): Amounts {
  return {
    cliffUnlock: CLIFF_AMOUNT,
    deposited: DEPOSIT_AMOUNT,
    refunded: ZERO_BN,
    startUnlock: START_AMOUNT,
    withdrawn: ZERO_BN,
  };
}

export function amountsAfterCreateWithZeroUnlocks(): Amounts {
  return {
    cliffUnlock: ZERO_BN,
    deposited: DEPOSIT_AMOUNT,
    refunded: ZERO_BN,
    startUnlock: ZERO_BN,
    withdrawn: ZERO_BN,
  };
}

export function timestamps(): Timestamps {
  return {
    start: START_TIME,
    cliff: CLIFF_TIME,
    end: END_TIME,
  };
}

export function unlockAmounts(): UnlockAmounts {
  return { cliff: CLIFF_AMOUNT, start: START_AMOUNT };
}

export function unlockAmountsZero(): UnlockAmounts {
  return { cliff: ZERO_BN, start: ZERO_BN };
}
