import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet, BN, Program } from "@coral-xyz/anchor";

import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  transfer,
} from "@solana/spl-token";

import { SablierMerkleInstant } from "../../target/types/sablier_merkle_instant";
import {
  getProof,
  getRoot,
  LeafData,
} from "../../tests/merkle_instant/utils/merkle";

import {
  CAMPAIGN_SEED,
  CAMPAIGN_NAME,
  IPFS_CID,
  AGGREGATE_AMOUNT,
  CLAIM_AMOUNT,
} from "../../tests/merkle_instant/utils/defaults";

let anchorProvider: any;
let merkleInstant: anchor.Program<SablierMerkleInstant>;
let campaignCreatorKeys: Keypair;

let leaves: LeafData[];
let merkleRoot: number[];
let merkleProof: number[][];

let recipient1: Keypair;
let recipient2: Keypair;
let recipient3: Keypair;

describe("SablierLockup post-deployment initialization", () => {
  beforeEach(async () => {
    await configureTestingEnvironment();
    await initializeSablierMerkleInstant();
  });

  it("Creates a Merkle Instant Campaign, funds it and claims from it", async () => {
    // Create a token mint and mint some tokens to the campaign creator
    const { tokenMint: airdropTokenMint, campaignCreatorATA } =
      await createTokenAndMintToCampaignCreator();

    // Create the campaign
    const expirationTime = new BN(
      Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60
    ); // 10 days into the future
    const recipientCount = leaves.length;
    await merkleInstant.methods
      .createCampaign(
        merkleRoot,
        expirationTime,
        CAMPAIGN_NAME,
        IPFS_CID,
        AGGREGATE_AMOUNT,
        recipientCount
      )
      .signers([campaignCreatorKeys])
      .accounts({
        creator: campaignCreatorKeys.publicKey,
        airdropTokenMint: airdropTokenMint,
        airdropTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Derive the address of the campaign
    const campaign = getPDAAddress([
      Buffer.from(CAMPAIGN_SEED),
      campaignCreatorKeys.publicKey.toBuffer(),
      Buffer.from(merkleRoot),
      expirationTime.toArrayLike(Buffer, "le", 8),
      Buffer.from(CAMPAIGN_NAME),
      airdropTokenMint.toBuffer(),
    ]);

    // Derive the address of the campaign ATA
    const campaignATA = (
      await getOrCreateAssociatedTokenAccount(
        anchorProvider.connection,
        campaignCreatorKeys,
        airdropTokenMint,
        campaign,
        true
      )
    ).address;

    // Fund the campaign with the aggregate amount
    await transfer(
      anchorProvider.connection,
      campaignCreatorKeys,
      campaignCreatorATA,
      campaignATA,
      campaignCreatorKeys.publicKey,
      AGGREGATE_AMOUNT.toNumber()
    );

    // Claim from the campaign
    const recipientIndex = 0;
    await merkleInstant.methods
      .claim(recipientIndex, CLAIM_AMOUNT, merkleProof)
      .signers([campaignCreatorKeys])
      .accountsPartial({
        claimer: campaignCreatorKeys.publicKey,
        campaign,
        recipient: campaignCreatorKeys.publicKey,
        airdropTokenMint,
        airdropTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  });
});

async function configureTestingEnvironment() {
  anchorProvider = AnchorProvider.env();
  anchor.setProvider(anchorProvider);

  merkleInstant = anchor.workspace
    .SablierMerkleInstant as Program<SablierMerkleInstant>;

  // Initialize the accounts involved in the tests
  campaignCreatorKeys = (anchorProvider.wallet as Wallet).payer;

  recipient1 = Keypair.generate();
  recipient2 = Keypair.generate();
  recipient3 = Keypair.generate();

  // Declare the leaves of the Merkle Tree before hashing and sorting
  leaves = [
    {
      index: 0,
      // Use the default recipient's public key for the first leaf
      recipient: campaignCreatorKeys.publicKey,
      amount: CLAIM_AMOUNT,
    },
    { index: 1, recipient: recipient1.publicKey, amount: CLAIM_AMOUNT },
    { index: 2, recipient: recipient2.publicKey, amount: CLAIM_AMOUNT },
    { index: 3, recipient: recipient3.publicKey, amount: CLAIM_AMOUNT },
  ];

  merkleRoot = getRoot(leaves);
  merkleProof = getProof(leaves, leaves[0]);
}

async function initializeSablierMerkleInstant() {
  await merkleInstant.methods
    .initialize(campaignCreatorKeys.publicKey)
    .signers([campaignCreatorKeys])
    .accounts({
      initializer: campaignCreatorKeys.publicKey,
    })
    .rpc();
}

// HELPER FUNCTIONS AND DATA STRUCTS

async function createTokenAndMintToCampaignCreator(): Promise<{
  tokenMint: PublicKey;
  campaignCreatorATA: PublicKey;
}> {
  const TOKEN_DECIMALS = 6;
  const freezeAuthority = null;

  const tokenMint = await createMint(
    anchorProvider.connection,
    campaignCreatorKeys,
    campaignCreatorKeys.publicKey,
    freezeAuthority,
    TOKEN_DECIMALS,
    Keypair.generate()
  );

  const campaignCreatorATA = (
    await getOrCreateAssociatedTokenAccount(
      anchorProvider.connection,
      campaignCreatorKeys,
      tokenMint,
      campaignCreatorKeys.publicKey
    )
  ).address;

  await mintTo(
    anchorProvider.connection,
    campaignCreatorKeys,
    tokenMint,
    campaignCreatorATA,
    campaignCreatorKeys,
    Number(AGGREGATE_AMOUNT)
  );

  return {
    tokenMint,
    campaignCreatorATA: campaignCreatorATA,
  };
}

export function getPDAAddress(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey = merkleInstant.programId
): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}
