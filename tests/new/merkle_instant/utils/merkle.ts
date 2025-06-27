import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";

// ---- LeafData interface ----
export interface LeafData {
  index: number;
  recipient: PublicKey;
  amount: BN;
}

// ---- Compute the leaf ----
function computeLeaf(leafData: LeafData): Buffer {
  const indexBytes = Buffer.alloc(4);
  indexBytes.writeUInt32LE(leafData.index);

  const recipientBytes = leafData.recipient.toBuffer(); // 32 bytes

  const amountBytes = Buffer.alloc(8);
  const amount =
    typeof leafData.amount === "bigint"
      ? leafData.amount
      : BigInt(leafData.amount.toString());
  amountBytes.writeBigUInt64LE(amount);

  const leafBytes = Buffer.concat([indexBytes, recipientBytes, amountBytes]);

  const firstHash = Buffer.from(keccak256(leafBytes));
  const finalHash = Buffer.from(keccak256(firstHash));

  return finalHash;
}

function buildTree(leaves: LeafData[]): MerkleTree {
  const hashedLeaves = leaves.map(computeLeaf);
  return new MerkleTree(hashedLeaves, keccak256, { sortPairs: true });
}

// ---- Get root as number[] ----
export function getRoot(leaves: LeafData[]): number[] {
  const tree = buildTree(leaves);
  return Array.from(tree.getRoot());
}

// ---- Get proof for a specific leaf as number[][] ----
export function getProof(leaves: LeafData[], targetLeaf: LeafData): number[][] {
  const tree = buildTree(leaves);

  const targetHash = computeLeaf(targetLeaf);
  const proofBuffers = tree.getProof(targetHash).map((p) => p.data);

  return proofBuffers.map((buf) => Array.from(buf));
}
