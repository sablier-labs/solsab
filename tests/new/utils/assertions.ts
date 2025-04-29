import { Amounts, StreamData, Timestamps, UnlockAmounts } from "./types";
import { assert } from "chai";
export { assert };

export function assertAmounts(a: Amounts, b: Amounts) {
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

export function assertStreamData(a: StreamData, b: StreamData) {
  assertAmounts(a.amounts, b.amounts);
  assertTimestamps(a.timestamps, b.timestamps);
  assert(
    a.assetMint.equals(b.assetMint),
    `Asset mint addresses mismatch: ${a.assetMint.toBase58()} !== ${b.assetMint.toBase58()}`
  );
  assert(a.id.eq(b.id), `Stream IDs mismatch: ${a.id} !== ${b.id}`);
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

export function assertTimestamps(a: Timestamps, b: Timestamps) {
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
export function assertUnlockAmounts(a: UnlockAmounts, b: UnlockAmounts) {
  assert(a.cliff.eq(b.cliff), "Cliff unlock amounts mismatch");
  assert(a.start.eq(b.start), "Start unlock amounts mismatch");
}

export function assertError(
  error: unknown,
  hexErrorCode: string,
  message?: string
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const expectedText = `custom program error: ${hexErrorCode}`;

  assert(
    errorMessage.includes(expectedText),
    message || `Expected error code ${hexErrorCode} not found`
  );
}

export function assertFail(reason = "Expected to fail it didn't"): void {
  assert.fail(reason);
}
