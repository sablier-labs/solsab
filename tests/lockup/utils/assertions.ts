import { assert } from "vitest";
import { ProgramErrorCode, type ProgramErrorName } from "../../../target/types/sablier_lockup_errors";
import type { Amounts, StreamData, Timestamps } from "../../../target/types/sablier_lockup_structs";
import { assertEqBn, assertEqPublicKey, expectToThrow as baseExpectToThrow } from "../../common/assertions";
import type { UnlockAmounts } from "./types";

export function assertEqStreamData(a: StreamData, b: StreamData) {
  assertEqAmounts(a.amounts, b.amounts);
  assertEqTimestamps(a.timestamps, b.timestamps);

  assertEqPublicKey(
    a.depositedTokenMint,
    b.depositedTokenMint,
    `Asset mint addresses mismatch: ${a.depositedTokenMint.toBase58()} !== ${b.depositedTokenMint.toBase58()}`,
  );
  assertEqBn(a.salt, b.salt);
  assert.equal(a.isCancelable, b.isCancelable);
  assert.equal(a.isDepleted, b.isDepleted);
  assertEqPublicKey(a.sender, b.sender, `Sender address mismatch: ${a.sender.toBase58()} !== ${b.sender.toBase58()}`);
  assert.equal(a.wasCanceled, b.wasCanceled);
}

export function assertEqTimestamps(a: Timestamps, b: Timestamps) {
  assertEqBn(a.cliff, b.cliff);
  assertEqBn(a.end, b.end);
  assertEqBn(a.start, b.start);
}

export function assertEqUnlockAmounts(a: UnlockAmounts, b: UnlockAmounts) {
  assertEqBn(a.cliff, b.cliff);
  assertEqBn(a.start, b.start);
}

export function expectToThrow(promise: Promise<unknown>, errorNameOrCode: ProgramErrorName | number) {
  return baseExpectToThrow(promise, ProgramErrorCode, errorNameOrCode);
}

/* -------------------------------------------------------------------------- */
/*                               INTERNAL LOGIC                               */
/* -------------------------------------------------------------------------- */

function assertEqAmounts(a: Amounts, b: Amounts) {
  assertEqBn(a.deposited, b.deposited);
  assertEqBn(a.refunded, b.refunded);
  assertEqBn(a.withdrawn, b.withdrawn);

  // Unlock amounts
  assertEqBn(a.cliffUnlock, b.cliffUnlock);
  assertEqBn(a.startUnlock, b.startUnlock);
}
