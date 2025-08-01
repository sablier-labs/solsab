import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { type AddedAccount } from "solana-bankrun";
import { toBn } from "./helpers";

export const CHAINLINK_PROGRAM = new PublicKey("HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny");
export const CHAINLINK_SOL_USD_FEED = new PublicKey("99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR");

/// To get this mock data run: `solana account 99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR --url devnet --output json`
/// Current data returns:
/// price: $3.98332798
/// timestamp: August 1, 2025 10:20 PM
const MOCK_ACCOUNT_DATA = new Uint8Array(
  Buffer.from(
    "YLNFQoCBSXUCAWQUUYa2ANnUYYrbqZcNlEBTsnm1vMbAD/Shxwnxadi/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AAD9IzGmE6swmiVX6E+mpeINgNJ4h4AyDGib6NC7wlNPTCAvIFVTRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAD0tLMBAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACYM74XAAAAADZKjWgAAAAAIAzdxQMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "base64",
  ),
);
const PRICE: BN = toBn(3_98332798);
// 200000000 * 1000000000 / 398332798
/// Mirror function from `lockup/src/utils/fee_calculation.rs`
export async function feeInLamports(feeUsd: BN, priceUsd: BN = PRICE): Promise<BN> {
  const oracleDecimals = 8;

  if (oracleDecimals === 8) {
    return feeUsd.mul(toBn(LAMPORTS_PER_SOL)).div(priceUsd);
  } else {
    const multiplier = toBn(10).pow(toBn(1 + oracleDecimals));
    return feeUsd.mul(multiplier).div(priceUsd);
  }
}

export function mockChainlinkAccount(): AddedAccount {
  return {
    address: CHAINLINK_SOL_USD_FEED,
    info: {
      data: MOCK_ACCOUNT_DATA,
      executable: false,
      lamports: 2616962,
      owner: CHAINLINK_PROGRAM,
    },
  };
}

// Helper to create mocks with different price AND timestamp
export function mockChainlinkAccountWithPriceAndTimestamp(priceUsd: BN, timestamp: BN): AddedAccount {
  const data = new Uint8Array(MOCK_ACCOUNT_DATA);

  // Update price at offset 200 (8 bytes, little-endian)
  const chainlinkPrice = priceUsd.toNumber();
  const priceBytes = new ArrayBuffer(8);
  const priceView = new DataView(priceBytes);
  priceView.setBigUint64(0, BigInt(chainlinkPrice), true);
  data.set(new Uint8Array(priceBytes), 200);

  // Update timestamp at offset 208 (4 bytes, little-endian)
  const timestampBytes = new ArrayBuffer(4);
  const timestampView = new DataView(timestampBytes);
  timestampView.setUint32(0, timestamp.toNumber(), true);
  data.set(new Uint8Array(timestampBytes), 208);

  return {
    address: CHAINLINK_SOL_USD_FEED,
    info: {
      data,
      executable: false,
      lamports: 2616962,
      owner: CHAINLINK_PROGRAM,
    },
  };
}

export function getPriceFromChainlinkData(): bigint {
  const data = new Uint8Array(MOCK_ACCOUNT_DATA);

  // Read price from offset 200 (8 bytes, little-endian)
  let price = 0n;
  for (let i = 0; i < 8; i++) {
    price += BigInt(data[200 + i]) << BigInt(8 * i);
  }

  return price;
}
