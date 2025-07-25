import { LAMPORTS_PER_SOL as raw_LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";

export const BN_0 = new BN(0);
export const BN_1 = new BN(1);
export const BN_1000 = new BN(1000);
export const LAMPORTS_PER_SOL = new BN(raw_LAMPORTS_PER_SOL);
export const MIN_LAMPORTS_BALANCE = new BN(1_000_000); // 0.001 SOL
export const SCALING_FACTOR = new BN("1000000000000000000"); // 1e18
export const SOL_DECIMALS = 9;
export const USDC_DECIMALS = 6;
export const ZERO = new BN(0);
