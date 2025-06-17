import { assert } from "chai";
export { assert };

import { PublicKey } from "@solana/web3.js";

import { CampaignData } from "./types";

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

export function assertEqCampaignDatas(a: CampaignData, b: CampaignData) {
  assert(
    a.airdropTokenMint.equals(b.airdropTokenMint),
    `Airdrop token mints mismatch: ${a.airdropTokenMint.toBase58()} !== ${b.airdropTokenMint.toBase58()}`
  );
  assert(
    a.creator.equals(b.creator),
    `Creators mismatch: ${a.creator.toBase58()} !== ${b.creator.toBase58()}`
  );
  assert(
    a.expirationTime.eq(b.expirationTime),
    `Expiration times mismatch: ${a.expirationTime.toString()} !== ${b.expirationTime.toString()}`
  );
  assert(
    a.firstClaimTime.eq(b.firstClaimTime),
    `First claim times mismatch: ${a.firstClaimTime.toString()} !== ${b.firstClaimTime.toString()}`
  );
  assert(
    a.ipfsId === b.ipfsId,
    `IPFS IDs mismatch: ${a.ipfsId} !== ${b.ipfsId}`
  );
  assert(
    a.merkleRoot.length === b.merkleRoot.length &&
      a.merkleRoot.every((value, index) => value === b.merkleRoot[index]),
    `Merkle roots mismatch: ${a.merkleRoot} !== ${b.merkleRoot}`
  );
  assert(a.name === b.name, `Campaign names mismatch: ${a.name} !== ${b.name}`);
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
