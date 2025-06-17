import { assert } from "chai";
export { assert };

import {
  Amounts,
  PublicKey,
  StreamData,
  Timestamps,
  UnlockAmounts,
} from "./types";

export function assertEqAmounts(a: Amounts, b: Amounts) {
  assert(
    a.cliffUnlock.eq(b.cliffUnlock),
    `Cliff unlock amounts mismatch: ${a.cliffUnlock} !== ${b.cliffUnlock}`
  );
  assert(
    a.deposited.eq(b.deposited),
    `Deposited amounts mismatch: ${a.deposited} !== ${b.deposited}`
  );
  assert(
    a.refunded.eq(b.refunded),
    `Refunded amounts mismatch: ${a.refunded} !== ${b.refunded}`
  );
  assert(
    a.startUnlock.eq(b.startUnlock),
    `Start unlock amounts mismatch: ${a.startUnlock} !== ${b.startUnlock}`
  );
  assert(
    a.withdrawn.eq(b.withdrawn),
    `Withdrawn amounts mismatch: ${a.withdrawn} !== ${b.withdrawn}`
  );
}

export function assertEqStreamDatas(a: StreamData, b: StreamData) {
  assertEqAmounts(a.amounts, b.amounts);
  assertEqTimestamps(a.timestamps, b.timestamps);

  assert(
    a.depositedTokenMint.equals(b.depositedTokenMint),
    `Asset mint addresses mismatch: ${a.depositedTokenMint.toBase58()} !== ${b.depositedTokenMint.toBase58()}`
  );
  assert(a.salt.eq(b.salt), `Salt values mismatch: ${a.salt} !== ${b.salt}`);
  assert(
    a.isCancelable === b.isCancelable,
    `Cancelable flag mismatch: ${a.isCancelable} !== ${b.isCancelable}`
  );
  assert(
    a.isDepleted === b.isDepleted,
    `Depleted flag mismatch: ${a.isDepleted} !== ${b.isDepleted}`
  );
  assert(
    a.sender.equals(b.sender),
    `Sender address mismatch: ${a.sender.toBase58()} !== ${b.sender.toBase58()}`
  );
  assert(
    a.wasCanceled === b.wasCanceled,
    `Was canceled flag mismatch: ${a.wasCanceled} !== ${b.wasCanceled}`
  );
}

export function assertEqTimestamps(a: Timestamps, b: Timestamps) {
  assert(
    a.cliff.eq(b.cliff),
    `Cliff timestamps mismatch: ${a.cliff} !== ${b.cliff}`
  );
  assert(a.end.eq(b.end), `End timestamps mismatch: ${a.end} !== ${b.end}`);
  assert(
    a.start.eq(b.start),
    `Start timestamps mismatch: ${a.start} !== ${b.start}`
  );
}

export function assertEqUnlockAmounts(a: UnlockAmounts, b: UnlockAmounts) {
  assert(a.cliff.eq(b.cliff), "Cliff unlock amounts mismatch");
  assert(a.start.eq(b.start), "Start unlock amounts mismatch");
}

export function assertErrorHexCode(error: unknown, hexErrorCode: string) {
  assertErrorContains(
    error,
    `custom program error: ${hexErrorCode}`,
    `The expected error code ${hexErrorCode} not found in "${error}"`
  );
}

export function assertErrorContains(
  error: unknown,
  expectedText: string,
  message?: string
) {
  assert(errorToMessage(error).includes(expectedText), message);
}

export function assertFail() {
  assert.fail("Expected the tx to revert, but it succeeded.");
}

export function assertSigVerificationFailureFor(
  pubkey: PublicKey,
  error: unknown
) {
  assertErrorContains(
    error,
    `Signature verification failed.\nMissing signature for public key [\`${pubkey.toBase58()}\`].`,
    `Signature verification for \`${pubkey.toBase58()}\` not detected in "${error}"`
  );
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
