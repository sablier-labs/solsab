/**
 * @file Convert a floating point number to a token amount in its decimal system.
 *
 * @param amount - The amount to convert, as either a number or a string.
 * @returns The number of tokens in their smallest unit.
 *
 * @example
 * ```ts
 * sol("1.02"); // 1_020_000_000
 * sol(10_000); // 10_000_000_000_000
 * usdc("100.5"); // 100_500_000
 * ```
 *
 * @todo: Make this work with scientific notation inputs.
 */
import { BN } from "@coral-xyz/anchor";
import _ from "lodash";
import { parseUnits } from "viem";
import { Decimals } from "./constants";

function convertTokenAmount(amount: number | string, decimals: number): BN {
  if (typeof amount === "number") {
    if (!_.isInteger(amount)) {
      throw new Error(
        `Amount must be an integer, got: ${amount}. If you want to use floating points, pass it as a string.`,
      );
    }
    return new BN(amount).mul(new BN(10 ** decimals));
  }

  return new BN(parseUnits(amount, decimals));
}

export function dai(amount: number | string): BN {
  return convertTokenAmount(amount, Decimals.DAI);
}

export function sol(amount: number | string): BN {
  return convertTokenAmount(amount, Decimals.SOL);
}

export function usdc(amount: number | string): BN {
  return convertTokenAmount(amount, Decimals.USDC);
}
