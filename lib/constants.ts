import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, LAMPORTS_PER_SOL as raw_LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";

export const BN_1 = new BN(1);
export const BN_1000 = new BN(1000);
export const LAMPORTS_PER_SOL = new BN(raw_LAMPORTS_PER_SOL);
export const REDUNDANCY_BUFFER = new BN(1_000_000); // 0.001 SOL
export const SCALING_FACTOR = new BN("1000000000000000000"); // 1e18
export const ZERO = new BN(0);

export namespace Decimals {
  export const DAI = 9;
  export const SOL = 9;
  export const USDC = 6;
}

export namespace ProgramId {
  export const CHAINLINK_PROGRAM_ID = new PublicKey("HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny");
  export const CHAINLINK_SOL_USD_FEED_ID = new PublicKey("99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR");
  export const TOKEN = TOKEN_PROGRAM_ID;
  export const TOKEN_METADATA = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  export const TOKEN_2022 = TOKEN_2022_PROGRAM_ID;
}
