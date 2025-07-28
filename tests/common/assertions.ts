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

export function assertEqualSOLBalance(left: BN, right: BN, message?: string) {
  const actualSol = left.div(LAMPORTS_PER_SOL).toString();
  const expectedSol = right.div(LAMPORTS_PER_SOL).toString();
  const defaultMessage = `Balance mismatch: ${actualSol} SOL !== ${expectedSol} SOL`;
  assertEqualBn(left, right, message ?? defaultMessage);
}

export function assertEqualBn(left: BN, right: BN, message?: string) {
  const defaultMessage = `BN values mismatch: ${left.toString()} !== ${right.toString()}`;
  assert.isTrue(left.eq(right), message ?? defaultMessage);
}

export function assertEqualPublicKey(left: PublicKey, right: PublicKey, message?: string) {
  const defaultMessage = `PublicKey mismatch: ${left.toBase58()} !== ${right.toBase58()}`;
  assert.isTrue(left.equals(right), message ?? defaultMessage);
}

export function assertLteBn(left: BN, right: BN, message?: string) {
  const defaultMessage = `Expected ${left.toString()} to be <= to ${right.toString()}`;
  assert.isTrue(left.lte(right), message ?? defaultMessage);
}

export function assertZeroBn(left: BN, message?: string) {
  const defaultMessage = `Expected ${left.toString()} to be zero`;
  assert.isTrue(left.isZero(), message ?? defaultMessage);
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
