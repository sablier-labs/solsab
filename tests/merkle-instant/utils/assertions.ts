import { assert } from "vitest";
import { ProgramErrorCode, type ProgramErrorName } from "../../../target/types/sablier_merkle_instant_errors";
import type { Campaign as CampaignData } from "../../../target/types/sablier_merkle_instant_structs";
import { assertEqualBn, assertEqualPublicKey, expectToThrow as baseExpectToThrow } from "../../common/assertions";

export function expectToThrow(promise: Promise<unknown>, errorNameOrCode: ProgramErrorName | number) {
  return baseExpectToThrow(promise, ProgramErrorCode, errorNameOrCode);
}

export function assertEqCampaignData(a: CampaignData, b: CampaignData) {
  assertEqualPublicKey(a.airdropTokenMint, b.airdropTokenMint);
  assertEqualPublicKey(a.creator, b.creator);
  assertEqualBn(a.startTime, b.startTime);
  assertEqualBn(a.expirationTime, b.expirationTime);
  assertEqualBn(a.firstClaimTime, b.firstClaimTime);
  assert.equal(a.ipfsCid, b.ipfsCid);
  assert.equal(a.merkleRoot.length, b.merkleRoot.length);
  assert.deepEqual(a.merkleRoot, b.merkleRoot);
  assert.equal(a.name, b.name);
}
