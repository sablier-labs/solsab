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

import {
  StreamMilestones,
  UnlockAmounts,
  getDefaultUnlockAmounts,
} from "../../tests/utils";

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
    // await initializeSablierLockup();
  });

  it.only("Creates a cancelable SPL Token LL Stream", async () => {
    await testStreamCreation(
      true,
      await generateDefaultMilestones(),
      getDefaultUnlockAmounts()
    );

    //   await new Promise((resolve) => setTimeout(resolve, 6000));

    //   const amount = await lockupProgram.methods
    //     .withdrawableAmountOf(new BN(0))
    //     .simulate();

    //   console.log("Withdrawable amount: ", amount);
    //   console.log("Withdrawable amount (events): ", amount.events);
    //   console.log("Withdrawable amount (raw): ", amount.raw);
  });
});

// HELPER FUNCTIONS AND DATA STRUCTS

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
    .initializePhaseOne(senderKeys.publicKey)
    .signers([senderKeys])
    .accounts({
      deployer: senderKeys.publicKey,
    })
    .rpc();

  await lockupProgram.methods
    .initializePhaseTwo()
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

// async function getSOLBalanceOf(address: PublicKey): Promise<bigint> {
//   return (await getLamportsBalanceOf(address)) / BigInt(LAMPORTS_PER_SOL);
// }

async function generateDefaultMilestones(): Promise<StreamMilestones> {
  // Get the current timestamp
  const slot = await anchorProvider.connection.getSlot();
  const timestamp = await anchorProvider.connection.getBlockTime(slot);

  const startTime = new anchor.BN(timestamp); // Start immediately
  const cliffTime = new anchor.BN(timestamp + 5); // Cliff in 5 seconds
  const endTime = new anchor.BN(timestamp + 3600); // End in 1 hour

  return {
    startTime,
    cliffTime,
    endTime,
  };
}

async function testStreamCreation(
  isCancelable: boolean,
  milestones: StreamMilestones,
  unlockAmounts: UnlockAmounts
) {
  const { assetMint, mintedAmount: depositedAmount } =
    await createTokenAndMintToSender();

  // Get the initial token balance of the sender
  // const senderInitialTokenBalance = await getTokenBalanceByATAKey(senderATA);

  await prepareAndCreateWithTimestamps({
    senderKeys,
    recipient: recipientKeys.publicKey,
    assetMint,
    milestones,
    depositedAmount,
    unlockAmounts,
    isCancelable,
  });
}

interface PrepareAndCreateWithTimestampsArgs {
  senderKeys: Keypair;
  recipient: PublicKey;
  assetMint: PublicKey;
  milestones: StreamMilestones;
  depositedAmount: BN;
  unlockAmounts: UnlockAmounts;
  isCancelable: boolean;
}

interface CreateWithTimestampsArgs {
  senderKeys: Keypair;
  recipient: PublicKey;
  assetMint: PublicKey;
  expectedStreamId: BN;
  milestones: StreamMilestones;
  depositedAmount: BN;
  unlockAmounts: UnlockAmounts;
  isCancelable: boolean;
}

async function createTokenAndMintToSender(): Promise<{
  assetMint: PublicKey;
  senderATA: PublicKey;
  mintedAmount: BN;
}> {
  const TOKEN_DECIMALS = 9;
  const freezeAuthority = null;

  const assetMint = await createMint(
    anchorProvider.connection,
    senderKeys,
    senderKeys.publicKey,
    freezeAuthority,
    TOKEN_DECIMALS,
    Keypair.generate()
  );
  console.log(`Created Token Mint: ${assetMint}`);

  const senderATA = await getOrCreateAssociatedTokenAccount(
    anchorProvider.connection,
    senderKeys,
    assetMint,
    senderKeys.publicKey
  );
  console.log(`Sender's ATA: ${senderATA}`);

  const mintedAmount = new BN(2000);
  await mintTo(
    anchorProvider.connection,
    senderKeys,
    assetMint,
    senderATA.address,
    senderKeys,
    Number(mintedAmount)
  );
  console.log(`Minted ${mintedAmount} tokens to the Sender ATA`);

  return { assetMint, senderATA: senderATA.address, mintedAmount };
}

async function createWithTimestamps(args: CreateWithTimestampsArgs): Promise<{
  streamId: BN;
  streamNftMint: PublicKey;
  recipientsStreamNftATA: PublicKey;
  nftTokenProgram: PublicKey;
}> {
  const {
    senderKeys,
    expectedStreamId,
    milestones,
    unlockAmounts,
    depositedAmount,
    isCancelable,
    assetMint,
    recipient,
  } = args;

  const increaseCULimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000, // specify the additional compute units you need
  });

  const nftTokenProgram = TOKEN_PROGRAM_ID;
  await lockupProgram.methods
    .createWithTimestamps(
      milestones.startTime,
      unlockAmounts.startUnlock,
      milestones.cliffTime,
      unlockAmounts.cliffUnlock,
      milestones.endTime,
      depositedAmount,
      isCancelable
    )
    .accountsPartial({
      sender: senderKeys.publicKey,
      streamNftMint: getStreamNftMintAddress(expectedStreamId),
      assetMint,
      recipient,
      nftTokenProgram: TOKEN_PROGRAM_ID,
      assetTokenProgram: TOKEN_PROGRAM_ID,
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

async function prepareAndCreateWithTimestamps(
  args: PrepareAndCreateWithTimestampsArgs
): Promise<{
  nftTokenProgram: PublicKey;
  recipientsStreamNftATA: PublicKey;
  streamNftMint: PublicKey;
  treasuryATA: PublicKey;
}> {
  const {
    senderKeys,
    recipient,
    assetMint,
    milestones,
    depositedAmount,
    unlockAmounts,
    isCancelable,
  } = args;

  // const expectedStreamId = await deduceCurrentStreamId();
  const expectedStreamId = new BN(2);
  const { treasuryATA } = await prepareForStreamCreation(
    senderKeys,
    assetMint,
    expectedStreamId
  );

  const { streamNftMint, recipientsStreamNftATA, nftTokenProgram } =
    await createWithTimestamps({
      senderKeys,
      recipient,
      assetMint,
      expectedStreamId,
      milestones,
      depositedAmount,
      unlockAmounts,
      isCancelable,
    });

  return {
    nftTokenProgram,
    recipientsStreamNftATA,
    streamNftMint,
    treasuryATA,
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

async function prepareForStreamCreation(
  signerKeys: Keypair,
  assetMint: PublicKey,
  expectedStreamId: BN
): Promise<{ treasuryATA: PublicKey }> {
  try {
    await lockupProgram.methods
      .prepareForStreamCreation()
      .signers([signerKeys])
      .accountsPartial({
        sender: signerKeys.publicKey,
        assetMint,
        streamNftMint: getStreamNftMintAddress(expectedStreamId),
        nftTokenProgram: TOKEN_PROGRAM_ID,
        assetTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  } catch (err: any) {
    if (err instanceof anchor.web3.SendTransactionError) {
      console.error(
        "Transaction logs:",
        await err.getLogs(anchorProvider.connection)
      );
    }

    if (err.logs) {
      console.error("Full logs:", err.logs);
    } else if (typeof err.getLogs === "function") {
      console.error("Full logs:", err.getLogs());
    } else {
      console.error("Error:", err);
    }
    throw err;
  }

  return {
    treasuryATA: deriveATAAddress(assetMint, treasuryAddress, TOKEN_PROGRAM_ID),
  };
}

export function deriveATAAddress(
  mint: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey,
  programId: anchor.web3.PublicKey
): anchor.web3.PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true, programId);
}
