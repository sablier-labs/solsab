import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { keccak_256 } from "@noble/hashes/sha3";

export interface LeafData {
  index: number;
  recipient: PublicKey;
  amount: bigint | BN;
}

export class MerkleTree {
  /**
   * Compute leaf hash from LeafData
   */
  private static computeLeaf(leafData: LeafData): Buffer {
    // Convert index to little-endian bytes (u32 = 4 bytes)
    const indexBytes = Buffer.alloc(4);
    indexBytes.writeUInt32LE(leafData.index, 0);

    // Solana PublicKey is 32 bytes
    const recipientBytes = leafData.recipient.toBuffer();

    // Convert amount to little-endian bytes (u64 = 8 bytes)
    const amountBytes = Buffer.alloc(8);
    const amount =
      typeof leafData.amount === "bigint"
        ? leafData.amount
        : BigInt(leafData.amount.toString());
    amountBytes.writeBigUInt64LE(amount, 0);

    // Concatenate: index (4) + recipient (32) + amount (8) = 44 bytes total
    const leafBytes = Buffer.concat([indexBytes, recipientBytes, amountBytes]);

    // hash the leaf data
    const firstHash = Buffer.from(keccak_256(leafBytes));
    const leaf = Buffer.from(keccak_256(firstHash));

    return leaf;
  }

  /**
   * Sort leaf data and compute sorted leaves
   */
  private static sortLeaves(leafData: LeafData[]): Buffer[] {
    const leaves = leafData.map((data) => this.computeLeaf(data));
    return leaves.sort((a, b) => Buffer.compare(a, b));
  }

  /**
   * Build tree from sorted leaves
   */
  private static buildTree(sortedLeaves: Buffer[]): Buffer[][] {
    if (sortedLeaves.length === 0) {
      throw new Error("Cannot build tree with empty leaves");
    }

    const tree: Buffer[][] = [];
    tree.push([...sortedLeaves]);

    let currentLevel = [...sortedLeaves];

    while (currentLevel.length > 1) {
      const nextLevel: Buffer[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

        // Hash pair in sorted order
        const combinedHash =
          Buffer.compare(left, right) <= 0
            ? Buffer.from(keccak_256(Buffer.concat([left, right])))
            : Buffer.from(keccak_256(Buffer.concat([right, left])));

        nextLevel.push(combinedHash);
      }

      tree.push(nextLevel);
      currentLevel = nextLevel;
    }

    return tree;
  }

  /**
   * Get merkle root from array of LeafData
   */
  static getRoot(leafData: LeafData[]): number[] {
    const sortedLeaves = this.sortLeaves(leafData);
    const tree = this.buildTree(sortedLeaves);
    const root = tree[tree.length - 1][0];

    return Array.from(root);
  }

  /**
   * Get merkle proof for a specific LeafData by index
   */
  static getProof(leafData: LeafData[], index: number): number[][] {
    // Find the leaf data with the specified index
    const targetLeafData = leafData.find((data) => data.index === index);
    if (!targetLeafData) {
      throw new Error(`No leaf found with index ${index}`);
    }

    // Sort leaves and find position of target leaf
    const sortedLeaves = this.sortLeaves(leafData);
    const targetLeaf = this.computeLeaf(targetLeafData);
    const pos = sortedLeaves.findIndex((leaf) => leaf.equals(targetLeaf));

    if (pos === -1) {
      throw new Error(`Could not find leaf in sorted array for index ${index}`);
    }

    const tree = this.buildTree(sortedLeaves);
    const proof: Buffer[] = [];
    let currentIndex = pos;

    // Traverse up the tree
    for (let level = 0; level < tree.length - 1; level++) {
      const currentLevel = tree[level];
      const isRightNode = currentIndex % 2 === 1;

      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < currentLevel.length) {
        proof.push(currentLevel[siblingIndex]);
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof.map((p) => Array.from(p));
  }
}
