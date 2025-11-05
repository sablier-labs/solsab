import type { BN } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";
import { toBigInt } from "../../../lib/helpers";

export type LeafData = {
  index: number;
  recipient: PublicKey;
  amount: BN;
};

export function getProof(leaves: LeafData[], targetLeaf: LeafData): number[][] {
  const tree = buildTree(leaves);

  const targetHash = computeLeaf(targetLeaf);
  const proofBuffers = tree.getProof(targetHash).map((p) => p.data);

  return proofBuffers.map((buf) => Array.from(buf));
}

export function getRoot(leaves: LeafData[]): number[] {
  const tree = buildTree(leaves);
  return Array.from(tree.getRoot());
}

/* -------------------------------------------------------------------------- */
/*                               INTERNAL LOGIC                               */
/* -------------------------------------------------------------------------- */

function buildTree(leaves: LeafData[]): MerkleTree {
  const hashedLeaves = leaves.map(computeLeaf);
  return new MerkleTree(hashedLeaves, keccak256, { sortPairs: true });
}

function computeLeaf(leafData: LeafData): Buffer {
  const indexBytes = Buffer.alloc(4);
  indexBytes.writeUInt32LE(leafData.index);

  const recipientBytes = leafData.recipient.toBuffer(); // 32 bytes

  const amountBytes = Buffer.alloc(8);
  amountBytes.writeBigUInt64LE(toBigInt(leafData.amount));

  const leafBytes = Buffer.concat([indexBytes, recipientBytes, amountBytes]);

  const firstHash = Buffer.from(keccak256(leafBytes));
  const finalHash = Buffer.from(keccak256(firstHash));

  return finalHash;
}
