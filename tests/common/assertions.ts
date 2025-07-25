import { type PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { assert, expect } from "vitest";
import { LAMPORTS_PER_SOL } from "../../lib/constants";
import { type TestContext } from "./context";

export async function assertAccountExists(ctx: TestContext, account: PublicKey, accountName: string) {
  assert.isTrue(await ctx.accountExists(account), `${accountName} account does not exist when it should`);
}

export async function assertAccountNotExists(ctx: TestContext, account: PublicKey, accountName: string) {
  assert.isFalse(await ctx.accountExists(account), `${accountName} account exists when it should not`);
}

export function assertEqualBalanceSOL(actual: BN, expected: BN, message?: string) {
  const actualSol = actual.div(LAMPORTS_PER_SOL).toString();
  const expectedSol = expected.div(LAMPORTS_PER_SOL).toString();
  const defaultMessage = `Balance mismatch: ${actualSol} SOL !== ${expectedSol} SOL`;
  assertEqualBn(actual, expected, message ?? defaultMessage);
}

export function assertEqualBn(actual: BN, expected: BN, message?: string) {
  const defaultMessage = `BN values mismatch: ${actual.toString()} !== ${expected.toString()}`;
  assert.isTrue(actual.eq(expected), message ?? defaultMessage);
}

export function assertEqualPublicKey(actual: PublicKey, expected: PublicKey, message?: string) {
  const defaultMessage = `PublicKey mismatch: ${actual.toBase58()} !== ${expected.toBase58()}`;
  assert.isTrue(actual.equals(expected), message ?? defaultMessage);
}

export function assertLteBn(actual: BN, expected: BN, message?: string) {
  const defaultMessage = `Expected ${actual.toString()} to be <= to ${expected.toString()}`;
  assert.isTrue(actual.lte(expected), message ?? defaultMessage);
}

export function assertZeroBn(actual: BN, message?: string) {
  const defaultMessage = `Expected ${actual.toString()} to be zero`;
  assert.isTrue(actual.isZero(), message ?? defaultMessage);
}

export function expectToThrow<T extends Record<string, number>>(
  promise: Promise<unknown>,
  errorMap: T,
  errorNameOrCode: keyof T | number,
) {
  if (typeof errorNameOrCode === "number") {
    const hexErrorCode = `0x${errorNameOrCode.toString(16)}`;
    return expect(promise).rejects.toThrow(hexErrorCode);
  }

  const hexErrorCode = `0x${errorMap[errorNameOrCode].toString(16)}`;
  return expect(promise).rejects.toThrow(hexErrorCode);
}
