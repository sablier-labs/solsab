import { keccak_256 } from "@noble/hashes/sha3";
import bs58 from "bs58";

import { PublicKey, Keypair } from "@solana/web3.js";

import * as token from "@solana/spl-token";
export { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import { BN, Program } from "@coral-xyz/anchor";

import {
  buildSignAndProcessTx,
  deriveATAAddress,
  transfer,
} from "../anchor-bankrun-adapter";

import {
  banksClient,
  bankrunProvider,
  commonSetUp,
  createUser,
  dai,
  feeCollector,
  getLamportsOf,
  getPDAAddress,
  recipient,
  usdc,
} from "../common-base";

export {
  deriveATAAddress,
  getATABalance,
  getATABalanceMint,
  getMintTotalSupplyOf,
  transfer,
} from "../anchor-bankrun-adapter";

import { SablierMerkleInstant } from "../../../target/types/sablier_merkle_instant";
import IDL from "../../../target/idl/sablier_merkle_instant.json";

import * as defaults from "./utils/defaults";
import { CampaignData, CampaignIds, User } from "./utils/types";

// Programs and addresses
export let merkleInstantProgram: Program<SablierMerkleInstant>;
export let treasuryAddress: PublicKey;

// Users
export let campaignCreator: User;

// Campaigns
export let campaignIds: CampaignIds;

// Merkle Tree
let merkleLeaves: (string | number)[][];
let merkleLeavesHashes: Buffer[];
let merkleRoot: number[];
let merkleProof: number[][];

/*//////////////////////////////////////////////////////////////////////////
                                       SET-UP
//////////////////////////////////////////////////////////////////////////*/

export async function setUp({
  initProgram = true,
  createCampaigns = true,
  fundCampaigns = true,
} = {}) {
  // Call common setup with merkle-instant specific programs
  await commonSetUp("sablier_merkle_instant", new PublicKey(IDL.address));

  // Deploy the program being tested
  merkleInstantProgram = new Program<SablierMerkleInstant>(
    IDL,
    bankrunProvider
  );

  // Create the users
  campaignCreator = await createUser();

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress(
    [Buffer.from(defaults.TREASURY_SEED)],
    merkleInstantProgram.programId
  );

  // Initialize the Merkle Tree leaves
  merkleLeaves = [
    [0, recipient.keys.publicKey.toString(), defaults.CLAIM_AMOUNT.toNumber()],
    [1, campaignCreator.keys.publicKey.toString(), 1000000],
  ];

  // Hash the Merkle Tree leaves
  merkleLeavesHashes = merkleLeaves.map((r) =>
    hashLeaf(r[0] as number, r[1] as string, r[2] as number)
  );

  // Sort the leaves hashes before calculating the Merkle root
  const [left, right] =
    Buffer.compare(merkleLeavesHashes[0], merkleLeavesHashes[1]) <= 0
      ? [merkleLeavesHashes[0], merkleLeavesHashes[1]]
      : [merkleLeavesHashes[1], merkleLeavesHashes[0]];

  // Calculate the Merkle root
  merkleRoot = Array.from(
    Buffer.from(keccak_256(Buffer.concat([left, right])))
  );

  // Create the Merkle proof for the first recipient
  merkleProof = [Array.from(merkleLeavesHashes[1])];

  if (initProgram) {
    // Initialize the Merkle Instant program
    await initializeMerkleInstant();

    if (createCampaigns) {
      // Create the campaigns
      campaignIds = {
        default: await createCampaign(),
        token2022: await createCampaignToken2022(),
        nonExisting: new PublicKey(1729), // A random address that doesn't exist
      };

      if (fundCampaigns) {
        // Fund the SPL and Token2022 campaigns
        await fundCampaign(
          campaignCreator.keys,
          campaignIds.default,
          usdc,
          campaignCreator.usdcATA,
          token.TOKEN_PROGRAM_ID,
          defaults.AGGREGATE_AMOUNT.toNumber()
        );

        await fundCampaign(
          campaignCreator.keys,
          campaignIds.token2022,
          dai,
          campaignCreator.daiATA,
          token.TOKEN_2022_PROGRAM_ID,
          defaults.AGGREGATE_AMOUNT.toNumber()
        );
      }
    }
  }
}

export async function fundCampaign(
  funderKeys: Keypair,
  campaignId: PublicKey,
  airdropTokenMint: PublicKey,
  funderATA: PublicKey,
  airdropTokenProgram: PublicKey,
  amount: number
): Promise<void> {
  // Determine the campaign ATA address
  const campaignATA = deriveATAAddress(
    airdropTokenMint,
    campaignId,
    airdropTokenProgram
  );

  // Transfer the specified amount from the funder to the campaign
  await transfer(
    banksClient,
    funderKeys,
    funderATA,
    campaignATA,
    funderKeys.publicKey,
    amount,
    [],
    airdropTokenProgram
  );
}

/*//////////////////////////////////////////////////////////////////////////
                                    TX-IX
//////////////////////////////////////////////////////////////////////////*/

export async function claim({
  claimerKeys = recipient.keys,
  campaignId = campaignIds.default,
  recipientAddress = recipient.keys.publicKey,
  recipientIndex = 0,
  amount = defaults.CLAIM_AMOUNT,
  merkleProof: argMerkleProof = merkleProof.map((p) => Array.from(p)), // Buffer -> number[]
  airdropTokenMint = usdc,
  airdropTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<void> {
  const claimIx = await merkleInstantProgram.methods
    .claim(recipientIndex, amount, argMerkleProof)
    .accounts({
      claimer: claimerKeys.publicKey,
      campaign: campaignId,
      recipient: recipientAddress,
      airdropTokenMint,
      airdropTokenProgram,
    })
    .instruction();

  // Build and sign the transaction
  await buildSignAndProcessTx(banksClient, claimIx, claimerKeys);
}

export async function claimToken2022(): Promise<void> {
  return await claim({
    campaignId: campaignIds.token2022,
    airdropTokenMint: dai,
    airdropTokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export async function clawback({
  signer = campaignCreator.keys,
  campaign = campaignIds.default,
  amount = defaults.CLAWBACK_AMOUNT,
  airdropTokenMint = usdc,
  airdropTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<void> {
  const clawbackIx = await merkleInstantProgram.methods
    .clawback(amount)
    .accounts({
      campaign,
      campaignCreator: signer.publicKey,
      airdropTokenMint,
      airdropTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, clawbackIx, signer);
}

export async function collectFees({
  signer = feeCollector.keys,
  feeRecipient = recipient.keys.publicKey,
} = {}): Promise<void> {
  const collectFeesIx = await merkleInstantProgram.methods
    .collectFees()
    .accounts({
      feeCollector: signer.publicKey,
      feeRecipient,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, collectFeesIx, signer);
}

export async function createCampaign({
  creatorKeys = campaignCreator.keys,
  merkleRoot: paramMerkleRoot = Array.from(merkleRoot),
  expirationTime = defaults.EXPIRATION_TIME,
  name = defaults.CAMPAIGN_NAME,
  ipfsCid = defaults.IPFS_CID,
  aggregateAmount = defaults.AGGREGATE_AMOUNT,
  recipientCount = merkleLeaves.length,
  airdropTokenMint = usdc,
  airdropTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<PublicKey> {
  // Create the transaction instruction
  const txIx = await merkleInstantProgram.methods
    .createCampaign(
      paramMerkleRoot,
      expirationTime,
      name,
      aggregateAmount,
      recipientCount
    )
    .accounts({
      creator: creatorKeys.publicKey,
      airdropTokenMint,
      airdropTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, txIx, creatorKeys);

  // Derive the address of the campaign
  const campaignAddress = getPDAAddress(
    [
      Buffer.from(defaults.CAMPAIGN_SEED),
      creatorKeys.publicKey.toBuffer(),
      Buffer.from(merkleRoot),
      expirationTime.toArrayLike(Buffer, "le", 8),
      Buffer.from(ipfsCid),
      Buffer.from(name),
      airdropTokenMint.toBuffer(),
    ],
    merkleInstantProgram.programId
  );

  return campaignAddress;
}

export async function createCampaignToken2022(
  tokenMint: PublicKey = dai
): Promise<PublicKey> {
  return await createCampaign({
    airdropTokenMint: tokenMint,
    airdropTokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export function defaultCampaignData(): CampaignData {
  return {
    airdropTokenMint: usdc,
    creator: campaignCreator.keys.publicKey,
    expirationTime: defaults.EXPIRATION_TIME,
    firstClaimTime: new BN(0),
    ipfsCid: defaults.IPFS_CID,
    merkleRoot: Array.from(merkleRoot),
    name: defaults.CAMPAIGN_NAME,
  };
}

export async function initializeMerkleInstant(): Promise<void> {
  const initializeIx = await merkleInstantProgram.methods
    .initialize(feeCollector.keys.publicKey)
    .accounts({
      initializer: campaignCreator.keys.publicKey,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, initializeIx, campaignCreator.keys);
}

/*//////////////////////////////////////////////////////////////////////////
                                  HELPERS
//////////////////////////////////////////////////////////////////////////*/

export async function fetchCampaignData(
  campaignId: PublicKey
): Promise<CampaignData> {
  const campaignAcc = await banksClient.getAccount(campaignId);
  if (!campaignAcc) {
    throw new Error("Campaign account is undefined");
  }

  // Return the Campaign data decoded via the Anchor account layout
  const campaignLayout = merkleInstantProgram.account.campaign;

  return campaignLayout.coder.accounts.decode(
    "campaign",
    Buffer.from(campaignAcc.data)
  );
}

export async function getTreasuryLamports(): Promise<bigint> {
  return await getLamportsOf(treasuryAddress);
}

export function hashLeaf(
  index: number,
  pubkeyBase58: string,
  amount: number
): Buffer {
  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32LE(index); // use LE to match Rust

  const pubkeyBuf = Buffer.from(bs58.decode(pubkeyBase58)); // 32 bytes

  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(BigInt(amount)); // LE, 8 bytes

  const packed = Buffer.concat([indexBuf, pubkeyBuf, amountBuf]);
  const firstHash = Buffer.from(keccak_256(packed));
  return Buffer.from(keccak_256(firstHash)); // double-hash
}
