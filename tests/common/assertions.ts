import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { assert, expect } from "vitest";
import type { TestContext } from "./context";
import type { Treasury } from "./types";

export async function assertAccountExists(ctx: TestContext, account: PublicKey, accountName: string) {
  assert.isTrue(await ctx.accountExists(account), `${accountName} account does not exist when it should`);
}

export async function assertAccountNotExists(ctx: TestContext, account: PublicKey, accountName: string) {
  assert.isFalse(await ctx.accountExists(account), `${accountName} account exists when it should not`);
}

export function assertEqBn(left: BN, right: BN, message?: string) {
  const defaultMessage = `BN values mismatch: ${left.toString()} !== ${right.toString()}`;
  assert.isTrue(left.eq(right), message ?? defaultMessage);
}

export function assertEqPublicKey(left: PublicKey, right: PublicKey, message?: string) {
  const defaultMessage = `PublicKey mismatch: ${left.toBase58()} !== ${right.toBase58()}`;
  assert.isTrue(left.equals(right), message ?? defaultMessage);
}

export function assertEqTreasury(left: Treasury, right: Treasury) {
  assert.isTrue(left.bump === right.bump, "Bump mismatch");
  assertEqPublicKey(left.chainlinkProgram, right.chainlinkProgram, "Chainlink program mismatch");
  assertEqPublicKey(left.chainlinkSolUsdFeed, right.chainlinkSolUsdFeed, "Chainlink sol usd feed mismatch");
  assertEqPublicKey(left.feeCollector, right.feeCollector, "Fee collector mismatch");
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
