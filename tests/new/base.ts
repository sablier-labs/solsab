import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction as TxIx,
  ComputeBudgetProgram,
} from "@solana/web3.js";

import { BN, Program } from "@coral-xyz/anchor";

import * as token from "@solana/spl-token";

import {
  BanksClient,
  Clock,
  ProgramTestContext,
  startAnchor,
} from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";

import { SablierLockup } from "../../target/types/sablier_lockup";
import IDL from "../../target/idl/sablier_lockup.json";

import * as defaults from "./utils/defaults";
import { Stream, StreamData, Salts, User } from "./utils/types";

import {
  createATA,
  createMint,
  deriveATAAddress,
  getATABalance,
  mintTo,
} from "./anchor-bankrun-adapter";

export {
  deriveATAAddress,
  getATABalance,
  getATABalanceMint,
  getMintTotalSupplyOf,
} from "./anchor-bankrun-adapter";

// Programs and addresses
export let banksClient: BanksClient;
let bankrunProvider: BankrunProvider;
let bankrunProviderPayer: Keypair;
let context: ProgramTestContext;
export let nftCollectionDataAddress: PublicKey;
export let lockupProgram: Program<SablierLockup>;
export let treasuryAddress: PublicKey;

// Users
export let defaultTxSigner: User;
export let sender: User;
export let recipient: User;
export let feeCollector: User;
export let eve: User;

// Tokens
export let usdc: PublicKey;
export let dai: PublicKey;
export let randomToken: PublicKey;

// Streams
export let salts: Salts;

/*//////////////////////////////////////////////////////////////////////////
                                       SET-UP
//////////////////////////////////////////////////////////////////////////*/

export async function setUp(initOrNot = true) {
  context = await startAnchor(
    "",
    [
      {
        name: "sablier_lockup",
        programId: new PublicKey(IDL.address),
      },
      {
        name: "token_metadata_program",
        programId: defaults.TOKEN_METADATA_PROGRAM_ID,
      },
    ],
    []
  );
  banksClient = context.banksClient;
  bankrunProvider = new BankrunProvider(context);
  bankrunProviderPayer = bankrunProvider.wallet.payer;

  // Deploy the program being tested
  lockupProgram = new Program<SablierLockup>(IDL, bankrunProvider);

  // Initialize the tokens
  await createTokens();

  // Create the users
  defaultTxSigner = await createUser(bankrunProvider.wallet.payer);
  sender = await createUser();
  recipient = await createUser();
  feeCollector = await createUser();
  eve = await createUser();

  // Pre-calculate the address of the NFT Collection Data
  nftCollectionDataAddress = getPDAAddress([
    Buffer.from(defaults.NFT_COLLECTION_DATA_SEED),
  ]);

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress([Buffer.from(defaults.TREASURY_SEED)]);

  // Set the block time to APR 1, 2025
  await timeTravelTo(defaults.APR_1_2025);

  if (initOrNot) {
    // Initialize the SablierLockup program
    await initializeSablierLockup();

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

async function createTokens(): Promise<void> {
  const mintAndFreezeAuthority = bankrunProviderPayer.publicKey; // Use the BankrunProvider's Payer since DefaultTxSigner isn't created yet

  dai = await createMint(
    banksClient,
    bankrunProviderPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    9,
    Keypair.generate(),
    token.TOKEN_2022_PROGRAM_ID
  );

  randomToken = await createMint(
    banksClient,
    bankrunProviderPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    6,
    Keypair.generate(),
    token.TOKEN_PROGRAM_ID
  );

  usdc = await createMint(
    banksClient,
    bankrunProviderPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    6,
    Keypair.generate(),
    token.TOKEN_PROGRAM_ID
  );
}

export async function createATAAndFund(
  mint: PublicKey,
  amount: number,
  tokenProgram: PublicKey,
  user: PublicKey
): Promise<PublicKey> {
  // Create ATA for the user
  const userATA = await createATA(
    banksClient,
    bankrunProviderPayer,
    mint,
    user,
    tokenProgram
  );

  // Mint the amount to the user's ATA
  await mintTo(
    banksClient,
    bankrunProviderPayer,
    mint,
    userATA,
    bankrunProviderPayer.publicKey,
    amount,
    [],
    tokenProgram
  );

  return userATA;
}

async function createATAsAndFund(
  user: PublicKey
): Promise<{ usdcATA: PublicKey; daiATA: PublicKey }> {
  // Create ATAs for the user
  const usdcATA = await createATAAndFund(
    usdc,
    defaults.USDC_USER_BALANCE,
    token.TOKEN_PROGRAM_ID,
    user
  );
  const daiATA = await createATAAndFund(
    dai,
    defaults.DAI_USER_BALANCE,
    token.TOKEN_2022_PROGRAM_ID,
    user
  );

  return { usdcATA, daiATA };
}

async function createUser(keypair?: Keypair): Promise<User> {
  if (!keypair) {
    keypair = Keypair.generate();

    // Set up the account info for the new keypair
    const accInfo = {
      lamports: 100 * LAMPORTS_PER_SOL, // Default balance (100 SOL)
      owner: new PublicKey("11111111111111111111111111111111"), // Default owner (System Program)
      executable: false, // Not a program account
      rentEpoch: 0, // Default rent epoch
      data: new Uint8Array(), // Empty data
    };

    // Add account to the BanksClient context
    context.setAccount(keypair.publicKey, accInfo);
  }

  // Create ATAs and mint tokens for the user
  const { usdcATA, daiATA } = await createATAsAndFund(keypair.publicKey);

  const user: User = {
    keys: keypair,
    usdcATA,
    daiATA,
  };

  return user;
}

/*//////////////////////////////////////////////////////////////////////////
                                    TX-IX
//////////////////////////////////////////////////////////////////////////*/

async function buildSignAndProcessTx(
  ixs: TxIx | TxIx[],
  signerKeys: Keypair | Keypair[] = bankrunProviderPayer,
  cuLimit: number = 1_400_000
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

export async function cancel({
  salt = salts.default,
  signer = sender.keys,
  depositedTokenMint = usdc,
  depositedTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<any> {
  const streamNftMint = getStreamNftMintAddress(salt);
  const cancelStreamIx = await lockupProgram.methods
    .cancel()
    .accounts({
      sender: signer.publicKey,
      depositedTokenMint,
      streamNftMint,
      depositedTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(cancelStreamIx, signer);
}

export async function cancelToken2022(salt: BN): Promise<any> {
  await cancel({
    salt,
    depositedTokenMint: dai,
    depositedTokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export async function collectFees(signer: Keypair = feeCollector.keys) {
  const collectFeesIx = await lockupProgram.methods
    .collectFees()
    .accounts({
      feeCollector: signer.publicKey,
      feeRecipient: sender.keys.publicKey,
    })
    .instruction();

  await buildSignAndProcessTx(collectFeesIx, signer);
}

export async function createWithDurations(
  cliffDuration = defaults.CLIFF_DURATION
): Promise<BN> {
  // Use the total supply as the salt for the stream
  const salt = await getTotalSupply();

  const createWithDurationsIx = await lockupProgram.methods
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
      creator: defaultTxSigner.keys.publicKey,
      sender: sender.keys.publicKey,
      depositTokenMint: usdc,
      recipient: recipient.keys.publicKey,
      depositTokenProgram: token.TOKEN_PROGRAM_ID,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(createWithDurationsIx);

  return salt;
}

export async function createWithTimestamps({
  creator = defaultTxSigner.keys,
  senderPubKey = sender.keys.publicKey,
  recipientPubKey = recipient.keys.publicKey,
  depositTokenMint = usdc,
  depositTokenProgram = token.TOKEN_PROGRAM_ID,
  timestamps = defaults.timestamps(),
  depositAmount = defaults.DEPOSIT_AMOUNT,
  unlockAmounts = defaults.unlockAmounts(),
  isCancelable = true,
} = {}): Promise<BN> {
  // Use the total supply as the salt for the stream
  const salt = await getTotalSupply();

  // Create the transaction instruction
  const txIx = await lockupProgram.methods
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
      creator: creator.publicKey,
      sender: senderPubKey,
      depositTokenMint,
      recipient: recipientPubKey,
      depositTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(txIx, creator);

  return salt;
}

export async function createWithTimestampsToken2022(): Promise<BN> {
  return await createWithTimestamps({
    depositTokenMint: dai,
    depositTokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export async function initializeSablierLockup(): Promise<void> {
  const initializeIx = await lockupProgram.methods
    .initialize(feeCollector.keys.publicKey)
    .accounts({
      initializer: bankrunProviderPayer.publicKey,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(initializeIx);
}

export async function renounce({
  salt = salts.default,
  signer = sender.keys,
} = {}): Promise<any> {
  const streamNftMint = getStreamNftMintAddress(salt);
  const renounceIx = await lockupProgram.methods
    .renounce()
    .accounts({
      sender: signer.publicKey,
      streamNftMint,
    })
    .instruction();

  await buildSignAndProcessTx(renounceIx, signer);
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
  const withdrawIx = await lockupProgram.methods
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

  await buildSignAndProcessTx(withdrawIx, signer);
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
  signer = recipient.keys,
  withdrawalRecipient = recipient.keys.publicKey,
  depositedTokenMint = usdc,
  depositedTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<any> {
  const streamNftMint = getStreamNftMintAddress(salt);

  const withdrawMaxIx = await lockupProgram.methods
    .withdrawMax()
    .accounts({
      signer: signer.publicKey,
      depositedTokenMint,
      streamRecipient: recipient.keys.publicKey,
      streamNftMint,
      withdrawalRecipient,
      depositedTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(withdrawMaxIx, signer);
}

/*//////////////////////////////////////////////////////////////////////////
                                  HELPERS
//////////////////////////////////////////////////////////////////////////*/

export async function accountExists(address: PublicKey): Promise<boolean> {
  return (await banksClient.getAccount(address)) != null;
}

export async function getLamportsOf(user: PublicKey): Promise<bigint> {
  return await banksClient.getBalance(user);
}

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
  depositedTokenProgram = token.TOKEN_PROGRAM_ID,
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
    depositedTokenProgram
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
    depositedTokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export async function fetchStreamData(salt = salts.default): Promise<any> {
  const streamDataAddress = getStreamDataAddress(salt);
  const streamDataAcc = await banksClient.getAccount(streamDataAddress);
  if (!streamDataAcc) {
    throw new Error("Stream Data account is undefined");
  }

  // Return the Stream data decoded via the Anchor account layout
  const streamLayout = lockupProgram.account.streamData;

  return streamLayout.coder.accounts.decode(
    "streamData",
    Buffer.from(streamDataAcc.data)
  );
}

export function getPDAAddress(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey = lockupProgram.programId
): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

export async function getCreatorTokenBalance(assetMint = usdc): Promise<BN> {
  const creatorAta =
    assetMint === usdc ? defaultTxSigner.usdcATA : defaultTxSigner.daiATA;
  return await getATABalance(banksClient, creatorAta);
}

function getStreamDataAddress(salt: BN): PublicKey {
  const streamNftMint = getStreamNftMintAddress(salt);
  const streamDataSeeds = [
    Buffer.from(defaults.STREAM_DATA_SEED),
    streamNftMint.toBuffer(),
  ];
  return getPDAAddress(streamDataSeeds);
}

function getStreamNftMintAddress(
  salt: BN,
  streamSender: PublicKey = sender.keys.publicKey
): PublicKey {
  // The seeds used when creating the Stream NFT Mint
  const streamNftMintSeeds = [
    Buffer.from(defaults.STREAM_NFT_MINT_SEED),
    streamSender.toBuffer(),
    salt.toBuffer("le", 16),
  ];

  return getPDAAddress(streamNftMintSeeds);
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
    lockupProgram.account.nftCollectionData.coder.accounts.decode(
      "nftCollectionData",
      Buffer.from(nftCollectionDataAcc.data)
    );

  const totalSupply = new BN(nftCollectionData.totalSupply.toString(), 10);
  return totalSupply;
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
