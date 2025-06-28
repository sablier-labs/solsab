import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";

import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  transfer,
} from "@solana/spl-token";

import { keccak_256 } from "@noble/hashes/sha3";

import { SablierMerkleInstant } from "../../target/types/sablier_merkle_instant";
import { hashLeaf } from "../../tests/new/merkle_instant/base";

const CAMPAIGN_SEED = "campaign";
const CLAIM_AMOUNT = new BN(100e6);
const AGGREGATE_AMOUNT = CLAIM_AMOUNT.add(new BN(1000000));
const IPFS_ID = "DefaultIpfsId";
const CAMPAIGN_NAME = "Default campaign name";

let anchorProvider: any;
let merkleInstantProgram: anchor.Program<SablierMerkleInstant>;
let campaignCreatorKeys: Keypair;

let recipients: (string | number)[][];
let leaves: Buffer[];
let merkleRoot: number[];
let merkleProof: number[][];

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
    const recipientCount = recipients.length;
    await merkleInstantProgram.methods
      .createCampaign(
        merkleRoot,
        expirationTime,
        IPFS_ID,
        CAMPAIGN_NAME,
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
      Buffer.from(IPFS_ID),
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
    await merkleInstantProgram.methods
      .claim(recipientIndex, CLAIM_AMOUNT, merkleProof)
      .signers([campaignCreatorKeys])
      .accountsPartial({
        claimer: campaignCreatorKeys.publicKey,
        recipient: campaignCreatorKeys.publicKey,
        campaign,
        airdropTokenMint,
        airdropTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  });
});

async function configureTestingEnvironment() {
  anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);

  merkleInstantProgram = anchor.workspace
    .SablierMerkleInstant as anchor.Program<SablierMerkleInstant>;

  // Initialize the accounts involved in the tests
  campaignCreatorKeys = (anchorProvider.wallet as anchor.Wallet).payer;

  // Create the Merkle Tree to use during initialization
  recipients = [
    [0, campaignCreatorKeys.publicKey.toString(), CLAIM_AMOUNT.toNumber()],
    [1, Keypair.generate().publicKey.toString(), 1000000],
  ];
  leaves = recipients.map((r) =>
    hashLeaf(r[0] as number, r[1] as string, r[2] as number)
  );
  // Sort leaves before concatenation to match Merkle tree convention
  const [left, right] =
    Buffer.compare(leaves[0], leaves[1]) <= 0
      ? [leaves[0], leaves[1]]
      : [leaves[1], leaves[0]];
  merkleRoot = Array.from(
    Buffer.from(keccak_256(Buffer.concat([left, right])))
  );
  merkleProof = [Array.from(leaves[1])];
}

async function initializeSablierMerkleInstant() {
  await merkleInstantProgram.methods
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
  programId: PublicKey = merkleInstantProgram.programId
): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}
