import { assert } from "vitest";
import type { ProgramErrorName } from "../../../target/types/sablier_lockup_errors";
import { ProgramErrorCode } from "../../../target/types/sablier_lockup_errors";
import type {
  Amounts,
  LinearTimestamps,
  LinearUnlockAmounts,
  StreamData,
  StreamModel,
} from "../../../target/types/sablier_lockup_structs";
import {
  assertEqBn,
  assertEqPublicKey,
  expectToThrow as baseExpectToThrow,
} from "../../common/assertions";
import type { UnlockAmounts } from "./types";
import { isLinearModel, isTranchedModel } from "./types";

export function assertEqStreamData(a: StreamData, b: StreamData) {
  assertEqAmounts(a.amounts, b.amounts);

  // Compare model-specific data
  assertEqStreamModel(a.model, b.model);

  assertEqPublicKey(
    a.depositedTokenMint,
    b.depositedTokenMint,
    `Asset mint addresses mismatch: ${a.depositedTokenMint.toBase58()} !== ${b.depositedTokenMint.toBase58()}`,
  );
  assertEqBn(a.salt, b.salt);
  assert.equal(a.isCancelable, b.isCancelable);
  assert.equal(a.isDepleted, b.isDepleted);
  assertEqPublicKey(
    a.sender,
    b.sender,
    `Sender address mismatch: ${a.sender.toBase58()} !== ${b.sender.toBase58()}`,
  );
  assert.equal(a.wasCanceled, b.wasCanceled);
}

export function assertEqLinearTimestamps(a: LinearTimestamps, b: LinearTimestamps) {
  assertEqBn(a.cliff, b.cliff, "cliff timestamps mismatch");
  assertEqBn(a.end, b.end, "end timestamps mismatch");
  assertEqBn(a.start, b.start, "start timestamps mismatch");
}

export function assertEqLinearUnlockAmounts(a: LinearUnlockAmounts, b: LinearUnlockAmounts) {
  assertEqBn(a.cliff, b.cliff, "cliff unlock amounts mismatch");
  assertEqBn(a.start, b.start, "start unlock amounts mismatch");
}

export function assertEqUnlockAmounts(a: UnlockAmounts, b: UnlockAmounts) {
  assertEqBn(a.cliff, b.cliff);
  assertEqBn(a.start, b.start);
}

export function expectToThrow(
  promise: Promise<unknown>,
  errorNameOrCode: ProgramErrorName | number,
) {
  return baseExpectToThrow(promise, ProgramErrorCode, errorNameOrCode);
}

/* -------------------------------------------------------------------------- */
/*                               INTERNAL LOGIC                               */
/* -------------------------------------------------------------------------- */

function assertEqAmounts(a: Amounts, b: Amounts) {
  assertEqBn(a.deposited, b.deposited, "deposited amounts mismatch");
  assertEqBn(a.refunded, b.refunded, "refunded amounts mismatch");
  assertEqBn(a.withdrawn, b.withdrawn, "withdrawn amounts mismatch");
}

function assertEqStreamModel(a: StreamModel, b: StreamModel) {
  if (isLinearModel(a) && isLinearModel(b)) {
    assertEqLinearTimestamps(a.linear.timestamps, b.linear.timestamps);
    assertEqLinearUnlockAmounts(a.linear.unlockAmounts, b.linear.unlockAmounts);
  } else if (isTranchedModel(a) && isTranchedModel(b)) {
    assertEqBn(
      a.tranched.timestamps.start,
      b.tranched.timestamps.start,
      "tranched start timestamps mismatch",
    );
    assertEqBn(
      a.tranched.timestamps.end,
      b.tranched.timestamps.end,
      "tranched end timestamps mismatch",
    );
    assert.equal(
      a.tranched.tranches.length,
      b.tranched.tranches.length,
      "tranches length mismatch",
    );
    for (let i = 0; i < a.tranched.tranches.length; i++) {
      assertEqBn(
        a.tranched.tranches[i].amount,
        b.tranched.tranches[i].amount,
        `tranche ${i} amount mismatch`,
      );
      assertEqBn(
        a.tranched.tranches[i].timestamp,
        b.tranched.tranches[i].timestamp,
        `tranche ${i} timestamp mismatch`,
      );
    }
  } else {
    assert.fail("Stream models do not match (one is Linear, other is Tranched)");
  }
}
