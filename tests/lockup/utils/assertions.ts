import { assert } from "vitest";
import { ProgramErrorCode, type ProgramErrorName } from "../../../target/types/sablier_lockup_errors";
import { assertEqualBn, assertEqualPublicKey, expectToThrow as baseExpectToThrow } from "../../common/assertions";
import { type Amounts, type StreamData, type Timestamps, type UnlockAmounts } from "./types";

export function assertEqStreamData(a: StreamData, b: StreamData) {
  assertEqAmounts(a.amounts, b.amounts);
  assertEqTimestamps(a.timestamps, b.timestamps);

  assertEqualPublicKey(
    a.depositedTokenMint,
    b.depositedTokenMint,
    `Asset mint addresses mismatch: ${a.depositedTokenMint.toBase58()} !== ${b.depositedTokenMint.toBase58()}`,
  );
  assertEqualBn(a.salt, b.salt);
  assert.equal(a.isCancelable, b.isCancelable);
  assert.equal(a.isDepleted, b.isDepleted);
  assertEqualPublicKey(
    a.sender,
    b.sender,
    `Sender address mismatch: ${a.sender.toBase58()} !== ${b.sender.toBase58()}`,
  );
  assert.equal(a.wasCanceled, b.wasCanceled);
}

export function assertEqTimestamps(a: Timestamps, b: Timestamps) {
  assertEqualBn(a.cliff, b.cliff);
  assertEqualBn(a.end, b.end);
  assertEqualBn(a.start, b.start);
}

export function assertEqUnlockAmounts(a: UnlockAmounts, b: UnlockAmounts) {
  assertEqualBn(a.cliff, b.cliff);
  assertEqualBn(a.start, b.start);
}

export function expectToThrow(promise: Promise<unknown>, errorNameOrCode: ProgramErrorName | number) {
  return baseExpectToThrow(promise, ProgramErrorCode, errorNameOrCode);
}

/* -------------------------------------------------------------------------- */
/*                               INTERNAL LOGIC                               */
/* -------------------------------------------------------------------------- */

function assertEqAmounts(a: Amounts, b: Amounts) {
  assertEqualBn(a.deposited, b.deposited);
  assertEqualBn(a.refunded, b.refunded);
  assertEqualBn(a.withdrawn, b.withdrawn);

  // Unlock amounts
  assertEqualBn(a.cliffUnlock, b.cliffUnlock);
  assertEqualBn(a.startUnlock, b.startUnlock);
}
