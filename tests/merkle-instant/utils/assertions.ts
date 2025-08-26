import { assert } from "vitest";
import { ProgramErrorCode, type ProgramErrorName } from "../../../target/types/sablier_merkle_instant_errors";
import type { Campaign as CampaignData } from "../../../target/types/sablier_merkle_instant_structs";
import { assertEqBn, assertEqPublicKey, expectToThrow as baseExpectToThrow } from "../../common/assertions";

export function expectToThrow(promise: Promise<unknown>, errorNameOrCode: ProgramErrorName | number) {
  return baseExpectToThrow(promise, ProgramErrorCode, errorNameOrCode);
}

export function assertEqCampaignData(a: CampaignData, b: CampaignData) {
  assertEqBn(a.aggregateAmount, b.aggregateAmount);
  assert.equal(a.airdropTokenDecimals, b.airdropTokenDecimals);
  assertEqPublicKey(a.airdropTokenMint, b.airdropTokenMint);
  assertEqPublicKey(a.creator, b.creator);
  assertEqBn(a.campaignStartTime, b.campaignStartTime);
  assertEqBn(a.expirationTime, b.expirationTime);
  assertEqBn(a.firstClaimTime, b.firstClaimTime);
  assert.equal(a.ipfsCid, b.ipfsCid);
  assert.equal(a.merkleRoot.length, b.merkleRoot.length);
  assert.deepEqual(a.merkleRoot, b.merkleRoot);
  assert.equal(a.name, b.name);
  assert.equal(a.recipientCount, b.recipientCount);
}
