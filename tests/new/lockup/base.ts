import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { PublicKey, Keypair } from "@solana/web3.js";

import { SablierLockup } from "../../../target/types/sablier_lockup";
import IDL from "../../../target/idl/sablier_lockup.json";

import * as defaults from "./utils/defaults";
import {
  CreateWithTimestampsParams,
  Stream,
  StreamData,
  Salts,
} from "./utils/types";

import {
  buildSignAndProcessTx,
  deriveATAAddress,
  getATABalance,
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
  User,
} from "../common-base";

export {
  deriveATAAddress,
  getATABalance,
  getATABalanceMint,
  getMintTotalSupplyOf,
} from "../anchor-bankrun-adapter";

// Programs and addresses
export let nftCollectionDataAddress: PublicKey;
export let lockup: Program<SablierLockup>;
export let treasuryAddress: PublicKey;

// Users
export let sender: User;

// Streams
export let salts: Salts;

/*//////////////////////////////////////////////////////////////////////////
                                       SET-UP
//////////////////////////////////////////////////////////////////////////*/

export async function setUp(initOrNot = true) {
  // Call common setup with lockup specific programs
  await commonSetUp("sablier_lockup", new PublicKey(IDL.address), [
    {
      name: "token_metadata_program",
      programId: defaults.TOKEN_METADATA_PROGRAM_ID,
    },
  ]);

  // Deploy the program being tested
  lockup = new Program<SablierLockup>(IDL, bankrunProvider);

  // Create the sender user.
  sender = await createUser();

  // Pre-calculate the address of the NFT Collection Data
  nftCollectionDataAddress = getPDAAddress(
    [Buffer.from(defaults.NFT_COLLECTION_DATA_SEED)],
    lockup.programId
  );

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress(
    [Buffer.from(defaults.TREASURY_SEED)],
    lockup.programId
  );

  if (initOrNot) {
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

/*//////////////////////////////////////////////////////////////////////////
                                    TX-IX
//////////////////////////////////////////////////////////////////////////*/

export async function cancel({
  salt = salts.default,
  signer = sender.keys,
  depositedTokenMint = usdc,
  depositedTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<any> {
  const streamNftMint = getStreamNftMintAddress(salt);
  const cancelStreamIx = await lockup.methods
    .cancel()
    .accounts({
      sender: signer.publicKey,
      depositedTokenMint,
      streamNftMint,
      depositedTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, cancelStreamIx, signer);
}

export async function cancelToken2022(salt: BN): Promise<any> {
  await cancel({
    salt,
    depositedTokenMint: dai,
    depositedTokenProgram: token.TOKEN_2022_PROGRAM_ID,
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

export async function createWithDurations(
  cliffDuration = defaults.CLIFF_DURATION
): Promise<BN> {
  // Use the total supply as the salt for the stream
  const salt = await getTotalSupply();

  const createWithDurationsIx = await lockup.methods
    .createWithDurations(
      salt,
      defaults.DEPOSIT_AMOUNT,
      cliffDuration,
      defaults.TOTAL_DURATION,
      defaults.START_AMOUNT,
      cliffDuration.eq(defaults.ZERO_BN)
        ? defaults.ZERO_BN
        : defaults.CLIFF_AMOUNT,
      true
    )
    .accounts({
      sender: sender.keys.publicKey,
      depositTokenMint: usdc,
      recipient: recipient.keys.publicKey,
      depositTokenProgram: token.TOKEN_PROGRAM_ID,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, createWithDurationsIx, sender.keys);

  return salt;
}

export async function createWithTimestamps(
  params: CreateWithTimestampsParams = {}
): Promise<BN> {
  const {
    senderPubKey = sender.keys.publicKey,
    recipientPubKey = recipient.keys.publicKey,
    depositTokenMint = usdc,
    depositTokenProgram = token.TOKEN_PROGRAM_ID,
    timestamps = defaults.timestamps(),
    depositAmount = defaults.DEPOSIT_AMOUNT,
    unlockAmounts = defaults.unlockAmounts(),
    isCancelable = true,
  } = params;

  // Use the total supply as the salt for the stream
  const salt = await getTotalSupply();

  const txIx = await lockup.methods
    .createWithTimestamps(
      salt,
      depositAmount,
      timestamps.start,
      timestamps.cliff,
      timestamps.end,
      unlockAmounts.start,
      unlockAmounts.cliff,
      isCancelable
    )
    .accounts({
      sender: senderPubKey,
      depositTokenMint,
      recipient: recipientPubKey,
      depositTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
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

export async function renounce({
  salt = salts.default,
  signer = sender.keys,
} = {}): Promise<any> {
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
  withdrawAmount = defaults.WITHDRAW_AMOUNT,
  signer = recipient.keys,
  withdrawalRecipient = recipient.keys.publicKey,
  depositedTokenMint = usdc,
  depositedTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<any> {
  const streamNftMint = getStreamNftMintAddress(salt);
  const withdrawIx = await lockup.methods
    .withdraw(withdrawAmount)
    .accounts({
      signer: signer.publicKey,
      depositedTokenMint,
      streamNftMint,
      streamRecipient: recipient.keys.publicKey,
      withdrawalRecipient,
      depositedTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, withdrawIx, signer);
}

export async function withdrawToken2022(
  salt: BN,
  signer: Keypair
): Promise<any> {
  await withdraw({
    salt,
    depositedTokenMint: dai,
    signer,
    depositedTokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export async function withdrawMax({
  salt = salts.default,
  signer = sender.keys.publicKey,
  withdrawalRecipient = recipient.keys.publicKey,
  depositedTokenMint = usdc,
  depositedTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<any> {
  const streamNftMint = getStreamNftMintAddress(salt);

  const withdrawMaxIx = await lockup.methods
    .withdrawMax()
    .accounts({
      signer,
      depositedTokenMint,
      streamRecipient: recipient.keys.publicKey,
      streamNftMint,
      withdrawalRecipient,
      depositedTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(banksClient, withdrawMaxIx, sender.keys);
}

/*//////////////////////////////////////////////////////////////////////////
                                  HELPERS
//////////////////////////////////////////////////////////////////////////*/

export async function getSenderLamports(): Promise<bigint> {
  return await getLamportsOf(sender.keys.publicKey);
}

export async function getStreamDataAtaBalance(
  salt = salts.default
): Promise<BN> {
  return getATABalance(banksClient, getStreamDataAddress(salt));
}

export async function getTreasuryLamports(): Promise<bigint> {
  return await getLamportsOf(treasuryAddress);
}

export function defaultStream({
  salt = salts.default,
  depositedTokenMint = usdc,
  tokenProgram = token.TOKEN_PROGRAM_ID,
  isCancelable = true,
  isDepleted = false,
  wasCanceled = false,
} = {}): Stream {
  const data: StreamData = {
    amounts: defaults.amountsAfterCreate(),
    depositedTokenMint,
    salt,
    isCancelable,
    isDepleted,
    timestamps: defaults.timestamps(),
    sender: sender.keys.publicKey,
    wasCanceled,
  };
  const streamDataAddress = getStreamDataAddress(salt);
  const streamDataAta = deriveATAAddress(
    depositedTokenMint,
    streamDataAddress,
    tokenProgram
  );
  const streamNftMint = getStreamNftMintAddress(salt);
  const recipientStreamNftAta = deriveATAAddress(
    streamNftMint,
    recipient.keys.publicKey,
    token.TOKEN_PROGRAM_ID
  );
  const streamNftMetadata = getPDAAddress(
    [
      Buffer.from(defaults.METADATA_SEED),
      defaults.TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      streamNftMint.toBuffer(),
    ],
    defaults.TOKEN_METADATA_PROGRAM_ID
  );
  const streamNftMasterEdition = getPDAAddress(
    [
      Buffer.from(defaults.METADATA_SEED),
      defaults.TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      streamNftMint.toBuffer(),
      Buffer.from(defaults.EDITION_SEED),
    ],
    defaults.TOKEN_METADATA_PROGRAM_ID
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
    salt,
    isCancelable,
    isDepleted,
    wasCanceled,
    tokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export async function fetchStreamData(salt = salts.default): Promise<any> {
  const streamDataAddress = getStreamDataAddress(salt);
  const streamDataAcc = await banksClient.getAccount(streamDataAddress);
  if (!streamDataAcc) {
    throw new Error("Stream Data account is undefined");
  }

  // Return the Stream data decoded via the Anchor account layout
  const streamLayout = lockup.account.streamData;

  return streamLayout.coder.accounts.decode(
    "streamData",
    Buffer.from(streamDataAcc.data)
  );
}

export async function getSenderTokenBalance(tokenMint = usdc): Promise<BN> {
  const senderAta = tokenMint === usdc ? sender.usdcATA : sender.daiATA;
  return await getATABalance(banksClient, senderAta);
}

function getStreamDataAddress(salt: BN): PublicKey {
  const streamNftMint = getStreamNftMintAddress(salt);
  const streamDataSeeds = [
    Buffer.from(defaults.STREAM_DATA_SEED),
    streamNftMint.toBuffer(),
  ];
  return getPDAAddress(streamDataSeeds, lockup.programId);
}

function getStreamNftMintAddress(
  salt: BN,
  signer: PublicKey = sender.keys.publicKey
): PublicKey {
  // The seeds used when creating the Stream NFT Mint
  const streamNftMintSeeds = [
    Buffer.from(defaults.STREAM_NFT_MINT_SEED),
    signer.toBuffer(),
    salt.toBuffer("le", 16),
  ];

  return getPDAAddress(streamNftMintSeeds, lockup.programId);
}

async function getTotalSupply(): Promise<BN> {
  const nftCollectionDataAcc = await banksClient.getAccount(
    nftCollectionDataAddress
  );

  if (!nftCollectionDataAcc) {
    throw new Error("NFT Collection Data account is undefined");
  }

  // Get the NFT Collection Data
  const nftCollectionData =
    lockup.account.nftCollectionData.coder.accounts.decode(
      "nftCollectionData",
      Buffer.from(nftCollectionDataAcc.data)
    );

  const totalSupply = new BN(nftCollectionData.totalSupply.toString(), 10);
  return totalSupply;
}
