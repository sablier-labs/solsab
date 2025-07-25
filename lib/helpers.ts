import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import _ from "lodash";
import { parseUnits } from "viem";
import { SOL_DECIMALS, USDC_DECIMALS } from "./constants";

export function getPDAAddress(seeds: Array<Buffer | Uint8Array>, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

export async function sleepFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @todo: Make this work with scientific notation inputs.
 *
 * Convert a floating point number to a SOL amount in lamports.
 * @param amount - The amount of SOL to convert, as a floating point number.
 * @returns The number of SOL in lamports.
 *
 * @example
 * ```ts
 * sol("1.02") // 1_020_000_000
 * ```
 */
export function sol(amount: number | string): BN {
  if (typeof amount === "number") {
    if (!_.isInteger(amount)) {
      throw new Error(
        `Amount must be an integer, got: ${amount}. If you want to use floating points, pass it as a string.`,
      );
    }
    return new BN(amount).mul(new BN(10 ** SOL_DECIMALS));
  }

  return new BN(parseUnits(amount, SOL_DECIMALS));
}

export function toBigInt(number: number | BN): bigint {
  return BigInt(number.toString());
}

export function toBn(number: number | bigint): BN {
  return new BN(number.toString());
}

/**
 * Convert a floating point number to a USDC amount.
 * @param amount - The amount of USDC to convert, as a floating point number.
 * @returns The amount of USDC.
 *
 * @example
 * ```ts
 * usdc("1.02") // 1_020_000
 * ```
 */
export function usdc(amount: number | string): BN {
  if (typeof amount === "number") {
    if (!_.isInteger(amount)) {
      throw new Error(
        `Amount must be an integer, got: ${amount}. If you want to use floating points, pass it as a string.`,
      );
    }
    return new BN(amount).mul(new BN(10 ** USDC_DECIMALS));
  }

  return new BN(parseUnits(amount, USDC_DECIMALS));
}
