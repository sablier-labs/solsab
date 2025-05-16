import { PublicKey, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";

import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { UnlockAmounts, getDefaultUnlockAmounts } from "../../tests/utils";

import { SablierLockup } from "../../target/types/sablier_lockup";

let anchorProvider: any;
let senderKeys: Keypair;
let recipientKeys: Keypair;
let treasuryAddress: PublicKey;
let feeCollectorDataAddress: PublicKey;
let nftCollectionDataAddress: PublicKey;
let lockupProgram: anchor.Program<SablierLockup>;
let lockupProgramId: PublicKey;

function configureConsoleLogs() {
  // Suppress console logs by default
  // Dev: comment the line below to see the logs in the console (useful when debugging)
  // console.log = () => {};
}

describe("SablierLockup post-deployment initialization", () => {
  beforeEach(async () => {
    configureConsoleLogs();
    await configureTestingEnvironment();
    // await logInfoAboutImportantAccounts();
    await initializeSablierLockup();
  });

  it("Creates 3 cancelable SPL Token LL Streams", async () => {
    for (let i = 0; i < 3; i++) {
      await createAStream(new BN(i));
    }
  });
});

// HELPER FUNCTIONS AND DATA STRUCTS

async function createAStream(expectedStreamId: BN) {
  await testStreamCreation(
    expectedStreamId,
    true,
    new BN(0),
    new BN(3600),
    getDefaultUnlockAmounts()
  );
}

async function configureTestingEnvironment() {
  anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);
  lockupProgram = anchor.workspace
    .SablierLockup as anchor.Program<SablierLockup>;

  lockupProgramId = lockupProgram.programId;

  // Initialize the accounts involved in the tests
  senderKeys = (anchorProvider.wallet as anchor.Wallet).payer;
  recipientKeys = anchor.web3.Keypair.generate();

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress([Buffer.from("treasury")], lockupProgramId);
  console.log("Treasury's address: ", treasuryAddress.toBase58());

  // Pre-calculate the address of the Fee Collector Data account
  feeCollectorDataAddress = getPDAAddress(
    [Buffer.from("fee_collector_data")],
    lockupProgramId
  );

  // Pre-calculate the address of the NFT Collection Data
  nftCollectionDataAddress = getPDAAddress(
    [Buffer.from("nft_collection_data")],
    lockupProgramId
  );
}

async function logInfoAboutImportantAccounts() {
  // Output the sender's public key
  console.log(`Sender: ${senderKeys.publicKey}`);

  // // Output the sender's SOL balance
  // const sendersBalance = await getSOLBalanceOf(senderKeys.publicKey);
  // console.log(`Sender's balance: ${sendersBalance.toString()} SOL`);

  // Output the recipient's public key
  console.log(`Recipient: ${recipientKeys.publicKey}`);

  // // Output the recipient's SOL balance
  // const recipientsBalance = await getSOLBalanceOf(recipientKeys.publicKey);
  // console.log(`Recipient's balance: ${recipientsBalance.toString()} SOL`);

  console.log(
    "NFT Collection Data's address: ",
    nftCollectionDataAddress.toBase58()
  );

  console.log(
    "Fee Collector Data address: ",
    feeCollectorDataAddress.toBase58()
  );
}

async function initializeSablierLockup() {
  await lockupProgram.methods
    .initialize(senderKeys.publicKey)
    .signers([senderKeys])
    .accounts({
      deployer: senderKeys.publicKey,
      nftTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

async function getLamportsBalanceOf(address: PublicKey): Promise<bigint> {
  return await anchorProvider.connection.getBalance(address);
}

async function testStreamCreation(
  expectedStreamId: BN,
  isCancelable: boolean,
  cliffDuration: BN,
  totalDuration: BN,
  unlockAmounts: UnlockAmounts
) {
  const { depositTokenMint, mintedAmount: depositedAmount } =
    await createTokenAndMintToSender();

  await createWithDurations({
    expectedStreamId,
    senderKeys,
    recipient: recipientKeys.publicKey,
    depositTokenMint,
    cliffDuration,
    totalDuration,
    depositedAmount,
    unlockAmounts,
    isCancelable,
  });
}

interface CreateWithDurationssArgs {
  senderKeys: Keypair;
  recipient: PublicKey;
  depositTokenMint: PublicKey;
  expectedStreamId: BN;
  cliffDuration: BN;
  totalDuration: BN;
  depositedAmount: BN;
  unlockAmounts: UnlockAmounts;
  isCancelable: boolean;
}

async function createTokenAndMintToSender(): Promise<{
  depositTokenMint: PublicKey;
  senderATA: PublicKey;
  mintedAmount: BN;
}> {
  const TOKEN_DECIMALS = 9;
  const freezeAuthority = null;

  const depositTokenMint = await createMint(
    anchorProvider.connection,
    senderKeys,
    senderKeys.publicKey,
    freezeAuthority,
    TOKEN_DECIMALS,
    Keypair.generate()
  );
  console.log(`Created Token Mint: ${depositTokenMint}`);

  const senderATA = await getOrCreateAssociatedTokenAccount(
    anchorProvider.connection,
    senderKeys,
    depositTokenMint,
    senderKeys.publicKey
  );
  console.log(`Sender's ATA: ${senderATA}`);

  const mintedAmount = new BN(2000);
  await mintTo(
    anchorProvider.connection,
    senderKeys,
    depositTokenMint,
    senderATA.address,
    senderKeys,
    Number(mintedAmount)
  );
  console.log(`Minted ${mintedAmount} tokens to the Sender ATA`);

  return {
    depositTokenMint: depositTokenMint,
    senderATA: senderATA.address,
    mintedAmount,
  };
}

async function createWithDurations(args: CreateWithDurationssArgs): Promise<{
  streamId: BN;
  streamNftMint: PublicKey;
  recipientsStreamNftATA: PublicKey;
  nftTokenProgram: PublicKey;
}> {
  const {
    senderKeys,
    expectedStreamId,
    cliffDuration,
    totalDuration,
    unlockAmounts,
    depositedAmount,
    isCancelable,
    depositTokenMint,
    recipient,
  } = args;

  const increaseCULimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000, // specify the additional compute units you need
  });

  const nftTokenProgram = TOKEN_PROGRAM_ID;
  await lockupProgram.methods
    .createWithDurations(
      expectedStreamId,
      depositedAmount,
      cliffDuration,
      totalDuration,
      unlockAmounts.startUnlock,
      unlockAmounts.cliffUnlock,
      isCancelable
    )
    .accountsPartial({
      sender: senderKeys.publicKey,
      streamNftMint: getStreamNftMintAddress(expectedStreamId),
      depositTokenMint,
      recipient,
      nftTokenProgram: TOKEN_PROGRAM_ID,
      depositTokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions([increaseCULimitIx])
    .rpc();

  const streamNftMint = getStreamNftMintAddress(expectedStreamId);
  const recipientsStreamNftATA = deriveATAAddress(
    streamNftMint,
    recipientKeys.publicKey,
    nftTokenProgram
  );

  return {
    streamId: expectedStreamId,
    streamNftMint,
    recipientsStreamNftATA,
    nftTokenProgram,
  };
}

function getPDAAddress(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey
): PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function getStreamNftMintAddress(streamId: BN): PublicKey {
  // The seeds used when creating the Stream NFT Mint
  const streamNftMintSeeds = [
    Buffer.from("stream_nft_mint"),
    streamId.toBuffer("le", 8),
  ];
  return getPDAAddress(streamNftMintSeeds, lockupProgramId);
}

export function deriveATAAddress(
  mint: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey,
  programId: anchor.web3.PublicKey
): anchor.web3.PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true, programId);
}
