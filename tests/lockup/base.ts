import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { type Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { ZERO } from "../../lib/constants";
import { ProgramName } from "../../lib/enums";
import { getPDAAddress, toBn } from "../../lib/helpers";
import IDL from "../../target/idl/sablier_lockup.json";
import { type SablierLockup } from "../../target/types/sablier_lockup";
import { buildSignAndProcessTx, deriveATAAddress, getATABalance } from "../common/anchor-bankrun";
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
import { AMOUNTS, Amount, ProgramId, Seed, TIMESTAMPS, Time, UNLOCK_AMOUNTS } from "./utils/defaults";
import type { Salts, Stream, StreamData } from "./utils/types";

export {
  deriveATAAddress,
  getATABalance,
  getATABalanceMint,
  getMintTotalSupplyOf,
} from "../common/anchor-bankrun";

/* -------------------------------------------------------------------------- */
/*                              CONFIG VARIABLES                              */
/* -------------------------------------------------------------------------- */

// Programs and addresses
export let nftCollectionDataAddress: PublicKey;
export let lockup: anchor.Program<SablierLockup>;
export let treasuryAddress: PublicKey;

// Users
export let sender: User;

// Streams
export let salts: Salts;

/* -------------------------------------------------------------------------- */
/*                                    SETUP                                   */
/* -------------------------------------------------------------------------- */

export async function setUp({ initProgram = true } = {}) {
  // Call common setup with lockup specific programs
  await commonSetUp(ProgramName.Lockup, new PublicKey(IDL.address), [
    {
      name: "token_metadata_program",
      programId: ProgramId.TOKEN_METADATA,
    },
  ]);

  // Deploy the program being tested
  lockup = new anchor.Program<SablierLockup>(IDL, bankrunProvider);

  // Create the sender user.
  sender = await createUser();

  // Compute the address of the NFT Collection Data
  nftCollectionDataAddress = getPDAAddress([Seed.NFT_COLLECTION_DATA], lockup.programId);

  // Compute the address of the Treasury
  treasuryAddress = getPDAAddress([Seed.TREASURY], lockup.programId);

  // Set the block time to an initial time
  await timeTravelTo(Time.GENESIS);

  if (initProgram) {
    // Initialize the SablierLockup program
    await initializeLockup();

    // Create the default streams
    salts = {
      default: await createWithTimestamps(),
      nonCancelable: await createWithTimestamps({
        isCancelable: false,
      }),
      nonExisting: new BN(1729),
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                                    TX-IX                                   */
/* -------------------------------------------------------------------------- */

export async function cancel({
  salt = salts.default,
  signer = sender.keys,
  depositedTokenMint = usdc,
  depositedTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<void> {
  const streamNftMint = getStreamNftMintAddress(salt);
  const cancelStreamIx = await lockup.methods
    .cancel()
    .accounts({
      depositedTokenMint,
      depositedTokenProgram,
      sender: signer.publicKey,
      streamNftMint,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, cancelStreamIx, signer);
}

export async function cancelToken2022(salt: BN): Promise<void> {
  await cancel({
    depositedTokenMint: dai,
    depositedTokenProgram: token.TOKEN_2022_PROGRAM_ID,
    salt,
  });
}

export async function collectFees(signer: Keypair = feeCollector.keys) {
  const collectFeesIx = await lockup.methods
    .collectFees()
    .accounts({
      feeCollector: signer.publicKey,
      feeRecipient: sender.keys.publicKey,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, collectFeesIx, signer);
}

export async function createWithDurations({
  cliffDuration = Time.CLIFF_DURATION,
  salt,
}: {
  cliffDuration?: BN;
  salt?: BN;
} = {}): Promise<BN> {
  // Use the total supply as the salt for the stream
  salt = salt ?? (await getTotalSupply());

  const createWithDurationsIx = await lockup.methods
    .createWithDurations(
      salt,
      Amount.DEPOSIT,
      cliffDuration,
      Time.TOTAL_DURATION,
      Amount.START,
      cliffDuration.isZero() ? ZERO : Amount.CLIFF,
      true,
    )
    .accounts({
      creator: sender.keys.publicKey,
      depositTokenMint: usdc,
      depositTokenProgram: token.TOKEN_PROGRAM_ID,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
      recipient: recipient.keys.publicKey,
      sender: sender.keys.publicKey,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, createWithDurationsIx, sender.keys);

  return salt;
}

export async function createWithTimestamps({
  creator = sender.keys,
  senderPubKey = sender.keys.publicKey,
  recipientPubKey = recipient.keys.publicKey,
  depositTokenMint = usdc,
  depositTokenProgram = token.TOKEN_PROGRAM_ID,
  timestamps = TIMESTAMPS(),
  depositAmount = Amount.DEPOSIT,
  unlockAmounts = UNLOCK_AMOUNTS(),
  isCancelable = true,
  salt = new BN(-1),
} = {}): Promise<BN> {
  // Use the total supply as the salt for the stream
  salt = salt.isNeg() ? await getTotalSupply() : salt;

  const txIx = await lockup.methods
    .createWithTimestamps(
      salt,
      depositAmount,
      timestamps.start,
      timestamps.cliff,
      timestamps.end,
      unlockAmounts.start,
      unlockAmounts.cliff,
      isCancelable,
    )
    .accounts({
      creator: creator.publicKey,
      depositTokenMint,
      depositTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
      recipient: recipientPubKey,
      sender: senderPubKey,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, txIx, sender.keys);

  return salt;
}

export async function createWithTimestampsToken2022(): Promise<BN> {
  return await createWithTimestamps({
    depositTokenMint: dai,
    depositTokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export async function initializeLockup(): Promise<void> {
  const initializeIx = await lockup.methods
    .initialize(feeCollector.keys.publicKey)
    .accounts({
      initializer: sender.keys.publicKey,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, initializeIx, sender.keys);
}

export async function renounce({ salt = salts.default, signer = sender.keys } = {}): Promise<void> {
  const streamNftMint = getStreamNftMintAddress(salt);
  const renounceIx = await lockup.methods
    .renounce()
    .accounts({
      sender: signer.publicKey,
      streamNftMint,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, renounceIx, signer);
}

export async function withdraw({
  salt = salts.default,
  withdrawAmount = Amount.WITHDRAW,
  signer = recipient.keys,
  withdrawalRecipient = recipient.keys.publicKey,
  depositedTokenMint = usdc,
  depositedTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<void> {
  const streamNftMint = getStreamNftMintAddress(salt);
  const withdrawIx = await lockup.methods
    .withdraw(withdrawAmount)
    .accounts({
      depositedTokenMint,
      depositedTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
      signer: signer.publicKey,
      streamNftMint,
      streamRecipient: recipient.keys.publicKey,
      withdrawalRecipient,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, withdrawIx, signer);
}

export async function withdrawToken2022(salt: BN, signer: Keypair): Promise<void> {
  await withdraw({
    depositedTokenMint: dai,
    depositedTokenProgram: token.TOKEN_2022_PROGRAM_ID,
    salt,
    signer,
  });
}

export async function withdrawMax({
  salt = salts.default,
  signer = sender.keys.publicKey,
  withdrawalRecipient = recipient.keys.publicKey,
  depositedTokenMint = usdc,
  depositedTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<void> {
  const streamNftMint = getStreamNftMintAddress(salt);

  const withdrawMaxIx = await lockup.methods
    .withdrawMax()
    .accounts({
      depositedTokenMint,
      depositedTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
      signer,
      streamNftMint,
      streamRecipient: recipient.keys.publicKey,
      withdrawalRecipient,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, withdrawMaxIx, sender.keys);
}

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export async function getSenderLamports(): Promise<BN> {
  return await getLamportsOf(sender.keys.publicKey);
}

export async function getStreamDataAtaBalance(salt = salts.default): Promise<BN> {
  return getATABalance(banksClient, getStreamDataAddress(salt));
}

export async function getTreasuryLamports(): Promise<BN> {
  return await getLamportsOf(treasuryAddress);
}

export function defaultStream({
  salt = salts.default,
  depositedTokenMint = usdc,
  tokenProgram = ProgramId.TOKEN,
  isCancelable = true,
  isDepleted = false,
  wasCanceled = false,
} = {}): Stream {
  const data: StreamData = {
    amounts: AMOUNTS(),
    depositedTokenMint,
    isCancelable,
    isDepleted,
    salt,
    sender: sender.keys.publicKey,
    timestamps: TIMESTAMPS(),
    wasCanceled,
  };
  const streamDataAddress = getStreamDataAddress(salt);
  const streamDataAta = deriveATAAddress(depositedTokenMint, streamDataAddress, tokenProgram);
  const streamNftMint = getStreamNftMintAddress(salt);
  const recipientStreamNftAta = deriveATAAddress(streamNftMint, recipient.keys.publicKey, ProgramId.TOKEN);
  const streamNftMetadata = getPDAAddress(
    [Seed.METADATA, ProgramId.TOKEN_METADATA.toBuffer(), streamNftMint.toBuffer()],
    ProgramId.TOKEN_METADATA,
  );
  const streamNftMasterEdition = getPDAAddress(
    [Seed.METADATA, ProgramId.TOKEN_METADATA.toBuffer(), streamNftMint.toBuffer(), Seed.EDITION],
    ProgramId.TOKEN_METADATA,
  );

  // Return the Stream object
  return {
    data,
    dataAddress: streamDataAddress,
    dataAta: streamDataAta,
    nftMasterEdition: streamNftMasterEdition,
    nftMetadataAddress: streamNftMetadata,
    nftMintAddress: streamNftMint,
    recipientStreamNftAta: recipientStreamNftAta,
  };
}

export function defaultStreamToken2022({
  salt = salts.default,
  isCancelable = true,
  isDepleted = false,
  wasCanceled = false,
} = {}): Stream {
  return defaultStream({
    depositedTokenMint: dai,
    isCancelable,
    isDepleted,
    salt,
    tokenProgram: ProgramId.TOKEN_2022,
    wasCanceled,
  });
}

export async function fetchStreamData(salt = salts.default): Promise<StreamData> {
  const streamDataAddress = getStreamDataAddress(salt);
  const streamDataAcc = await banksClient.getAccount(streamDataAddress);
  if (!streamDataAcc) {
    throw new Error("Stream Data account is undefined");
  }

  // Return the Stream data decoded via the Anchor account layout
  const streamLayout = lockup.account.streamData;

  return streamLayout.coder.accounts.decode<StreamData>("streamData", Buffer.from(streamDataAcc.data));
}

export async function getSenderTokenBalance(tokenMint = usdc): Promise<BN> {
  const senderAta = tokenMint === usdc ? sender.usdcATA : sender.daiATA;
  return await getATABalance(banksClient, senderAta);
}

function getStreamDataAddress(salt: BN): PublicKey {
  const streamNftMint = getStreamNftMintAddress(salt);
  const streamDataSeeds = [Seed.STREAM_DATA, streamNftMint.toBuffer()];
  return getPDAAddress(streamDataSeeds, lockup.programId);
}

function getStreamNftMintAddress(salt: BN, signer: PublicKey = sender.keys.publicKey): PublicKey {
  // The seeds used when creating the Stream NFT Mint
  const streamNftMintSeeds = [Seed.STREAM_NFT_MINT, signer.toBuffer(), salt.toBuffer("le", 16)];

  return getPDAAddress(streamNftMintSeeds, lockup.programId);
}

async function getTotalSupply(): Promise<BN> {
  const nftCollectionDataAcc = await banksClient.getAccount(nftCollectionDataAddress);

  if (!nftCollectionDataAcc) {
    throw new Error("NFT Collection Data account is undefined");
  }

  // Get the NFT Collection Data
  const nftCollectionData = lockup.account.nftCollectionData.coder.accounts.decode(
    "nftCollectionData",
    Buffer.from(nftCollectionDataAcc.data),
  );

  const totalSupply = toBn(nftCollectionData.totalSupply);
  return totalSupply;
}
