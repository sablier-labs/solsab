import * as anchor from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { ZERO } from "../../lib/constants";
import { ProgramName } from "../../lib/enums";
import { getPDAAddress } from "../../lib/helpers";
import IDL from "../../target/idl/sablier_merkle_instant.json";
import { type SablierMerkleInstant } from "../../target/types/sablier_merkle_instant";
import { buildSignAndProcessTx, deriveATAAddress, transfer } from "../common/anchor-bankrun";
import {
  bankrunProvider,
  banksClient,
  setUp as commonSetUp,
  createUser,
  dai,
  feeCollector,
  getLamportsOf,
  recipient,
  timeTravelTo,
  usdc,
} from "../common/base";
import type { User } from "../common/types";
import { Amount, Campaign, Seed, Time } from "./utils/defaults";
import { getProof, getRoot, type LeafData } from "./utils/merkle";
import { type CampaignData } from "./utils/types";

// Programs and addresses
export let merkleInstant: anchor.Program<SablierMerkleInstant>;
export let treasuryAddress: PublicKey;

// Users
export let campaignCreator: User;

// Campaigns
export let defaultCampaign: PublicKey;
export let defaultCampaignToken2022: PublicKey;

/** For the recipient declared in @see {@link file://./../common/base.ts} */
export const defaultIndex = 0;
let defaultMerkleProof: number[][];

// Merkle Tree
let leaves: LeafData[];
let merkleRoot: number[];
let recipient1: PublicKey;
let recipient2: PublicKey;
let recipient3: PublicKey;

/* -------------------------------------------------------------------------- */
/*                                   SET-UP                                   */
/* -------------------------------------------------------------------------- */

export async function setUp({ initProgram = true } = {}): Promise<void> {
  // Call common setup with merkle-instant specific programs
  await commonSetUp(ProgramName.MerkleInstant, new PublicKey(IDL.address));

  // Deploy the program being tested
  merkleInstant = new anchor.Program<SablierMerkleInstant>(IDL, bankrunProvider);

  // Create the Campaign Creator user
  campaignCreator = await createUser();

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress([Seed.TREASURY], merkleInstant.programId);

  // Create the recipients to be included in the Merkle Tree
  recipient1 = (await createUser()).keys.publicKey;
  recipient2 = (await createUser()).keys.publicKey;
  recipient3 = (await createUser()).keys.publicKey;

  // Declare the leaves of the Merkle Tree before hashing and sorting
  leaves = [
    {
      amount: Amount.CLAIM,
      index: defaultIndex,
      // Use the default recipient's public key for the first leaf
      recipient: recipient.keys.publicKey,
    },
    { amount: Amount.CLAIM, index: 1, recipient: recipient1 },
    { amount: Amount.CLAIM, index: 2, recipient: recipient2 },
    { amount: Amount.CLAIM, index: 3, recipient: recipient3 },
  ];

  merkleRoot = getRoot(leaves);
  defaultMerkleProof = getProof(leaves, leaves[0]);

  // Set the block time to APR 1, 2025
  await timeTravelTo(Time.GENESIS);

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

/* -------------------------------------------------------------------------- */
/*                                    TX-IX                                   */
/* -------------------------------------------------------------------------- */

export async function claim({
  campaign = defaultCampaign,
  claimerKeys = recipient.keys,
  amount = Amount.CLAIM,
  recipientAddress = recipient.keys.publicKey,
  airdropTokenMint = usdc,
  airdropTokenProgram = TOKEN_PROGRAM_ID,
} = {}): Promise<void> {
  const txIx = await merkleInstant.methods
    .claim(defaultIndex, amount, defaultMerkleProof)
    .accounts({
      airdropTokenMint,
      airdropTokenProgram,
      campaign: campaign,
      claimer: claimerKeys.publicKey,
      recipient: recipientAddress,
    })
    .instruction();

  // Build and sign the transaction
  await buildSignAndProcessTx(banksClient, txIx, claimerKeys);
}

export async function clawback({
  signer = campaignCreator.keys,
  campaign = defaultCampaign,
  amount = Amount.CLAWBACK,
  airdropTokenMint = usdc,
  airdropTokenProgram = TOKEN_PROGRAM_ID,
} = {}): Promise<void> {
  const txIx = await merkleInstant.methods
    .clawback(amount)
    .accounts({
      airdropTokenMint,
      airdropTokenProgram,
      campaign,
      campaignCreator: signer.publicKey,
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
  name = Campaign.CAMPAIGN_NAME,
  campaignFunder = campaignCreator.keys,
  airdropTokenMint = usdc,
  airdropTokenProgram = TOKEN_PROGRAM_ID,
} = {}): Promise<PublicKey> {
  // Derive the address of the campaign
  const campaign = getPDAAddress(
    [
      Seed.CAMPAIGN,
      creator.keys.publicKey.toBuffer(),
      Buffer.from(merkleRoot),
      Time.EXPIRATION.toArrayLike(Buffer, "le", 8),
      Buffer.from(name),
      airdropTokenMint.toBuffer(),
    ],
    merkleInstant.programId,
  );

  const txIx = await merkleInstant.methods
    .createCampaign(merkleRoot, Time.EXPIRATION, name, Campaign.IPFS_CID, Amount.AGGREGATE, leaves.length)
    .accounts({
      airdropTokenMint,
      airdropTokenProgram,
      creator: creator.keys.publicKey,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, txIx, creator.keys);

  const campaignAta = deriveATAAddress(airdropTokenMint, campaign, airdropTokenProgram);

  const campaignFunderAta = deriveATAAddress(airdropTokenMint, campaignFunder.publicKey, airdropTokenProgram);

  // Transfer the aggregate amount from the campaign funder to the campaign
  await transfer(
    banksClient,
    campaignFunder,
    campaignFunderAta,
    campaignAta,
    campaignFunder.publicKey,
    Amount.AGGREGATE,
    [],
    airdropTokenProgram,
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

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export function defaultCampaignData(): CampaignData {
  return {
    airdropTokenMint: usdc,
    creator: campaignCreator.keys.publicKey,
    expirationTime: Time.EXPIRATION,
    firstClaimTime: ZERO,
    ipfsCid: Campaign.IPFS_CID,
    merkleRoot: Array.from(merkleRoot),
    name: Campaign.CAMPAIGN_NAME,
  };
}

export async function getTreasuryLamports(): Promise<BN> {
  return await getLamportsOf(treasuryAddress);
}

export async function fetchCampaignData(campaign = defaultCampaign): Promise<CampaignData> {
  return await merkleInstant.account.campaign.fetch(campaign);
}
