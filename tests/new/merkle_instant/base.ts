import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  buildSignAndProcessTx,
  deriveATAAddress,
  transfer,
} from "../anchor-bankrun-adapter";
import {
  banksClient,
  bankrunProvider,
  createUser,
  dai,
  feeCollector,
  getLamportsOf,
  getPDAAddress,
  recipient,
  setUp as commonSetUp,
  timeTravelTo,
  usdc,
  User,
} from "../common-base";

import * as defaults from "./utils/defaults";
import { getProof, getRoot, LeafData } from "./utils/merkle";
import { CampaignData } from "./utils/types";

import { SablierMerkleInstant } from "../../../target/types/sablier_merkle_instant";
import IDL from "../../../target/idl/sablier_merkle_instant.json";

// Programs and addresses
export let merkleInstant: Program<SablierMerkleInstant>;
export let treasuryAddress: PublicKey;

// Users
export let campaignCreator: User;

// Campaigns
export let defaultCampaign: PublicKey;
export let defaultCampaignToken2022: PublicKey;

// For the recipient declared in `common-base.ts`
export const defaultIndex = 0;
let defaultMerkleProof: number[][];

// Merkle Tree
let leaves: LeafData[];
let merkleRoot: number[];
let recipient1: PublicKey;
let recipient2: PublicKey;
let recipient3: PublicKey;

/*//////////////////////////////////////////////////////////////////////////
                                       SET-UP
//////////////////////////////////////////////////////////////////////////*/

export async function setUp({ initProgram = true } = {}) {
  // Call common setup with merkle-instant specific programs
  await commonSetUp("sablier_merkle_instant", new PublicKey(IDL.address));

  // Deploy the program being tested
  merkleInstant = new Program<SablierMerkleInstant>(IDL, bankrunProvider);

  // Create the Campaign Creator user
  campaignCreator = await createUser();

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress(
    [Buffer.from(defaults.TREASURY_SEED)],
    merkleInstant.programId
  );

  // Create the recipients to be included in the Merkle Tree
  recipient1 = (await createUser()).keys.publicKey;
  recipient2 = (await createUser()).keys.publicKey;
  recipient3 = (await createUser()).keys.publicKey;

  // Declare the leaves of the Merkle Tree before hashing and sorting
  leaves = [
    {
      index: defaultIndex,
      // Use the default recipient's public key for the first leaf
      recipient: recipient.keys.publicKey,
      amount: defaults.CLAIM_AMOUNT,
    },
    { index: 1, recipient: recipient1, amount: defaults.CLAIM_AMOUNT },
    { index: 2, recipient: recipient2, amount: defaults.CLAIM_AMOUNT },
    { index: 3, recipient: recipient3, amount: defaults.CLAIM_AMOUNT },
  ];

  merkleRoot = getRoot(leaves);
  defaultMerkleProof = getProof(leaves, leaves[0]);

  // Set the block time to APR 1, 2025
  await timeTravelTo(defaults.APR_1_2025);

  if (initProgram) {
    // Initialize the Merkle Instant program
    await initializeMerkleInstant();

    // Create the default campaigns
    defaultCampaign = await createCampaign();
    defaultCampaignToken2022 = await createCampaign({
      airdropTokenMint: dai,
      airdropTokenProgram: TOKEN_2022_PROGRAM_ID,
    });
  }
}

/*//////////////////////////////////////////////////////////////////////////
                                    TX-IX
//////////////////////////////////////////////////////////////////////////*/

export async function claim({
  campaign = defaultCampaign,
  claimerKeys = recipient.keys,
  amount = defaults.CLAIM_AMOUNT,
  recipientAddress = recipient.keys.publicKey,
  airdropTokenMint = usdc,
  airdropTokenProgram = TOKEN_PROGRAM_ID,
} = {}): Promise<void> {
  const txIx = await merkleInstant.methods
    .claim(defaultIndex, amount, defaultMerkleProof)
    .accounts({
      claimer: claimerKeys.publicKey,
      campaign: campaign,
      recipient: recipientAddress,
      airdropTokenMint,
      airdropTokenProgram,
    })
    .instruction();

  // Build and sign the transaction
  await buildSignAndProcessTx(banksClient, txIx, claimerKeys);
}

export async function clawback({
  signer = campaignCreator.keys,
  campaign = defaultCampaign,
  amount = defaults.CLAWBACK_AMOUNT,
  airdropTokenMint = usdc,
  airdropTokenProgram = TOKEN_PROGRAM_ID,
} = {}): Promise<void> {
  const txIx = await merkleInstant.methods
    .clawback(amount)
    .accounts({
      campaign,
      campaignCreator: signer.publicKey,
      airdropTokenMint,
      airdropTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, txIx, signer);
}

export async function collectFees({
  signer = feeCollector.keys,
  feeRecipient = recipient.keys.publicKey,
} = {}): Promise<void> {
  const txIx = await merkleInstant.methods
    .collectFees()
    .accounts({
      feeCollector: signer.publicKey,
      feeRecipient,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, txIx, signer);
}

export async function createCampaign({
  creator = campaignCreator,
  name = defaults.CAMPAIGN_NAME,
  campaignFunder = campaignCreator.keys,
  airdropTokenMint = usdc,
  airdropTokenProgram = TOKEN_PROGRAM_ID,
} = {}): Promise<PublicKey> {
  // Derive the address of the campaign
  const campaign = getPDAAddress(
    [
      Buffer.from(defaults.CAMPAIGN_SEED),
      creator.keys.publicKey.toBuffer(),
      Buffer.from(merkleRoot),
      defaults.EXPIRATION_TIME.toArrayLike(Buffer, "le", 8),
      Buffer.from(name),
      airdropTokenMint.toBuffer(),
    ],
    merkleInstant.programId
  );

  const txIx = await merkleInstant.methods
    .createCampaign(
      merkleRoot,
      defaults.EXPIRATION_TIME,
      name,
      defaults.IPFS_CID,
      defaults.AGGREGATE_AMOUNT,
      leaves.length
    )
    .accounts({
      creator: creator.keys.publicKey,
      airdropTokenMint,
      airdropTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, txIx, creator.keys);

  const campaignAta = deriveATAAddress(
    airdropTokenMint,
    campaign,
    airdropTokenProgram
  );

  const campaignFunderAta = deriveATAAddress(
    airdropTokenMint,
    campaignFunder.publicKey,
    airdropTokenProgram
  );

  // Transfer the aggregate amount from the campaign funder to the campaign
  await transfer(
    banksClient,
    campaignFunder,
    campaignFunderAta,
    campaignAta,
    campaignFunder.publicKey,
    defaults.AGGREGATE_AMOUNT,
    [],
    airdropTokenProgram
  );

  return campaign;
}

export async function initializeMerkleInstant(): Promise<void> {
  const initializeIx = await merkleInstant.methods
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

export async function fetchCampaignData(
  campaign = defaultCampaign
): Promise<CampaignData> {
  return await merkleInstant.account.campaign.fetch(campaign);
}

export async function getTreasuryLamports(): Promise<bigint> {
  return await getLamportsOf(treasuryAddress);
}
