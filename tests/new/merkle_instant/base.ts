import { keccak_256 } from "@noble/hashes/sha3";
import bs58 from "bs58";

import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction as TxIx,
  ComputeBudgetProgram,
} from "@solana/web3.js";

import * as token from "@solana/spl-token";
export { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import { BN, Program } from "@coral-xyz/anchor";

import {
  BanksClient,
  Clock,
  ProgramTestContext,
  startAnchor,
} from "solana-bankrun";

import { BankrunProvider } from "anchor-bankrun";

import {
  createATA,
  createMint,
  deriveATAAddress,
  mintTo,
  transfer,
} from "../anchor-bankrun-adapter";

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
export let banksClient: BanksClient;
let bankrunProvider: BankrunProvider;
let context: ProgramTestContext;
let defaultBankrunPayer: Keypair;
let merkleInstantProgram: Program<SablierMerkleInstant>;
export let treasuryAddress: PublicKey;

// Users
export let eve: User;
let feeCollector: User;
export let recipient: User;
export let campaignCreator: User;

// Campaigns
export let campaignIds: CampaignIds;

let merkleLeaves: (string | number)[][];
let merkleLeavesHashes: Buffer[];
let merkleRoot: number[];
let merkleProof: number[][];

// Tokens
export let usdc: PublicKey;
export let dai: PublicKey;
export let randomTokenSPL: PublicKey;
export let randomTokenToken2022: PublicKey;

/*//////////////////////////////////////////////////////////////////////////
                                       SET-UP
//////////////////////////////////////////////////////////////////////////*/

export async function setUp({
  initProgram = true,
  createCampaigns = true,
  fundCampaigns = true,
} = {}): Promise<void> {
  context = await startAnchor(
    "",
    [
      {
        name: "sablier_merkle_instant",
        programId: new PublicKey(IDL.address),
      },
    ],
    []
  );
  banksClient = context.banksClient;
  bankrunProvider = new BankrunProvider(context);
  defaultBankrunPayer = bankrunProvider.wallet.payer;

  // Deploy the program being tested
  merkleInstantProgram = new Program<SablierMerkleInstant>(
    IDL,
    bankrunProvider
  );

  // Initialize the tokens
  await createTokenMints();

  // Create the users
  eve = await createUser();
  feeCollector = await createUser();
  recipient = await createUser();
  campaignCreator = await createUser();

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress([Buffer.from(defaults.TREASURY_SEED)]);

  // Set the block time to APR 1, 2025
  await timeTravelTo(defaults.APR_1_2025);

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

async function createTokenMints(): Promise<void> {
  const mintAndFreezeAuthority = defaultBankrunPayer.publicKey;

  usdc = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    6,
    Keypair.generate(),
    token.TOKEN_PROGRAM_ID
  );

  randomTokenSPL = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    6,
    Keypair.generate(),
    token.TOKEN_PROGRAM_ID
  );

  dai = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    9,
    Keypair.generate(),
    token.TOKEN_2022_PROGRAM_ID
  );

  randomTokenToken2022 = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    9,
    Keypair.generate(),
    token.TOKEN_2022_PROGRAM_ID
  );
}

async function createCommonATAsAndMintTo(
  user: PublicKey
): Promise<{ usdcATA: PublicKey; daiATA: PublicKey }> {
  // Create the USDC and DAI ATAs for the user
  const usdcATA = await createATAAndMintTo(
    user,
    usdc,
    defaults.USDC_USER_BALANCE,
    token.TOKEN_PROGRAM_ID
  );

  const daiATA = await createATAAndMintTo(
    user,
    dai,
    defaults.DAI_USER_BALANCE,
    token.TOKEN_2022_PROGRAM_ID
  );

  return { usdcATA, daiATA };
}

export async function createATAAndMintTo(
  user: PublicKey,
  tokenMint: PublicKey,
  amount: number,
  tokenProgram: PublicKey
): Promise<PublicKey> {
  // Create ATA for the user
  const userATA = await createATA(
    banksClient,
    defaultBankrunPayer,
    tokenMint,
    user,
    tokenProgram
  );

  // Mint the requested amount to the user's ATA
  await mintTo(
    banksClient,
    defaultBankrunPayer,
    tokenMint,
    userATA,
    defaultBankrunPayer.publicKey,
    amount,
    [],
    tokenProgram
  );

  return userATA;
}

async function createUser(): Promise<User> {
  // Create the keypair for the user
  const userKeypair = Keypair.generate();

  // Set up the account info for the new keypair
  const accInfo = {
    lamports: 100 * LAMPORTS_PER_SOL, // Default balance (100 SOL)
    owner: new PublicKey("11111111111111111111111111111111"), // Default owner (System Program)
    executable: false, // Not a program account
    rentEpoch: 0, // Default rent epoch
    data: new Uint8Array(), // Empty data
  };

  // Add account to the BanksClient context
  context.setAccount(userKeypair.publicKey, accInfo);

  // Create ATAs and mint tokens for the user
  const { usdcATA, daiATA } = await createCommonATAsAndMintTo(
    userKeypair.publicKey
  );

  const user: User = {
    keys: userKeypair,
    usdcATA,
    daiATA,
  };

  return user;
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

async function buildSignAndProcessTx(
  ixs: TxIx | TxIx[],
  signerKeys: Keypair | Keypair[] = campaignCreator.keys,
  cuLimit: number = 1_400_000 // The maximum Compute Unit limit for a tx
) {
  // Get the latest blockhash
  const res = await banksClient.getLatestBlockhash();
  if (!res) throw new Error("Couldn't get the latest blockhash");

  // Initialize the transaction
  const tx = new Transaction();
  tx.recentBlockhash = res[0];

  // Add compute unit limit instruction if specified
  if (cuLimit !== undefined) {
    const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: cuLimit,
    });
    tx.add(cuLimitIx);
  }

  // Add instructions to the transaction
  const internal_ixs: TxIx[] = Array.isArray(ixs) ? ixs : [ixs];
  internal_ixs.forEach((ix) => tx.add(ix));

  // Ensure `signerKeys` is always an array
  const signers = Array.isArray(signerKeys) ? signerKeys : [signerKeys];

  // Sign the transaction with all provided signers
  tx.sign(...signers);

  // Process the transaction
  const txMeta = await banksClient.processTransaction(tx);
  return txMeta;
}

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
  await buildSignAndProcessTx(claimIx, claimerKeys);
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

  await buildSignAndProcessTx(clawbackIx, signer);
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

  await buildSignAndProcessTx(collectFeesIx, signer);
}

export async function createCampaign({
  creatorKeys = campaignCreator.keys,
  merkleRoot: paramMerkleRoot = Array.from(merkleRoot),
  expirationTime = defaults.EXPIRATION_TIME,
  name = defaults.CAMPAIGN_NAME,
  ipfsId = defaults.IPFS_ID,
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
      ipfsId,
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

  await buildSignAndProcessTx(txIx, creatorKeys);

  // Derive the address of the campaign
  const campaignAddress = getPDAAddress([
    Buffer.from(defaults.CAMPAIGN_SEED),
    creatorKeys.publicKey.toBuffer(),
    Buffer.from(merkleRoot),
    expirationTime.toArrayLike(Buffer, "le", 8),
    Buffer.from(ipfsId),
    Buffer.from(name),
    airdropTokenMint.toBuffer(),
  ]);

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
    ipfsId: defaults.IPFS_ID,
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

  await buildSignAndProcessTx(initializeIx);
}

/*//////////////////////////////////////////////////////////////////////////
                                  HELPERS
//////////////////////////////////////////////////////////////////////////*/

export async function accountExists(address: PublicKey): Promise<boolean> {
  return (await banksClient.getAccount(address)) != null;
}

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

export async function getLamportsOf(user: PublicKey): Promise<bigint> {
  return await banksClient.getBalance(user);
}

export function getPDAAddress(seeds: Array<Buffer | Uint8Array>): PublicKey {
  return PublicKey.findProgramAddressSync(
    seeds,
    merkleInstantProgram.programId
  )[0];
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

export async function sleepFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function timeTravelTo(timestamp: bigint | BN) {
  const currentClock = await banksClient.getClock();
  const timestampAsBigInt =
    timestamp instanceof BN ? BigInt(timestamp.toString()) : timestamp;

  context.setClock(
    new Clock(
      currentClock.slot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      timestampAsBigInt
    )
  );
}
