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
import {
  CreateWithTimestampsParams,
  StreamData,
  StreamIds,
  User,
} from "./utils/types";

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
  getMintTotalSupplyOf,
} from "./anchor-bankrun-adapter";

// Programs and addresses
export let banksClient: BanksClient;
let bankrunProvider: BankrunProvider;
let context: ProgramTestContext;
export let defaultBankrunPayer: Keypair;
export let nftCollectionDataAddress: PublicKey;
export let lockupProgram: Program<SablierLockup>;
export let streamNftMintAddress: PublicKey;
export let treasuryAddress: PublicKey;
export let treasuryATASpl: PublicKey;
export let treasuryATAToken2022: PublicKey;

// Users
export let eve: User;
export let feeCollector: User;
export let recipient: User;
export let sender: User;

// Tokens
export let usdc: PublicKey;
export let dai: PublicKey;
export let randomToken: PublicKey;

// StreamIds
export let ids: StreamIds;

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
  defaultBankrunPayer = bankrunProvider.wallet.payer;

  // Deploy the program being tested
  lockupProgram = new Program<SablierLockup>(IDL, bankrunProvider);

  // Initialize the tokens
  await createTokens();

  // Create the users
  eve = await createUser();
  feeCollector = await createUser();
  recipient = await createUser();
  sender = await createUser();

  // Pre-calculate the address of the NFT Collection Data
  nftCollectionDataAddress = getPDAAddress([
    Buffer.from(defaults.NFT_COLLECTION_DATA_SEED),
  ]);

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress([Buffer.from(defaults.TREASURY_SEED)]);
  treasuryATASpl = deriveATAAddress(
    usdc,
    treasuryAddress,
    token.TOKEN_PROGRAM_ID
  );
  treasuryATAToken2022 = deriveATAAddress(
    dai,
    treasuryAddress,
    token.TOKEN_2022_PROGRAM_ID
  );

  // Set the block time to APR 1, 2025
  await timeTravelTo(defaults.APR_1_2025);

  if (initOrNot) {
    // Initialize the SablierLockup program
    await initializeSablierLockup();

    // Create the default streams
    ids = {
      defaultStream: (await createWithTimestamps()).streamId,
      nonCancelableStream: (
        await createWithTimestamps({
          isCancelable: false,
        })
      ).streamId,
      nullStream: new BN(1729),
    };
  }
}

async function createTokens(): Promise<void> {
  const mintAndFreezeAuthority = defaultBankrunPayer.publicKey;

  dai = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    9,
    Keypair.generate(),
    token.TOKEN_2022_PROGRAM_ID
  );

  randomToken = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    6,
    Keypair.generate(),
    token.TOKEN_PROGRAM_ID
  );

  usdc = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    6,
    Keypair.generate(),
    token.TOKEN_PROGRAM_ID
  );
}

async function createATAsAndFund(
  user: PublicKey
): Promise<{ usdcATA: PublicKey; daiATA: PublicKey }> {
  // Create ATAs for the user
  const usdcATA = await createATA(
    banksClient,
    defaultBankrunPayer,
    usdc,
    user,
    token.TOKEN_PROGRAM_ID
  );
  const daiATA = await createATA(
    banksClient,
    defaultBankrunPayer,
    dai,
    user,
    token.TOKEN_2022_PROGRAM_ID
  );

  // Mint some tokens to the user's accounts
  await mintTokensToUser(usdcATA, daiATA);

  return { usdcATA, daiATA };
}

async function createUser(): Promise<User> {
  // Create the keypair for the user
  const acc = Keypair.generate();

  // Set up the account info for the new keypair
  const accInfo = {
    lamports: 100 * LAMPORTS_PER_SOL, // Default balance (100 SOL)
    owner: new PublicKey("11111111111111111111111111111111"), // Default owner (System Program)
    executable: false, // Not a program account
    rentEpoch: 0, // Default rent epoch
    data: new Uint8Array(), // Empty data
  };

  // Add account to the BanksClient context
  context.setAccount(acc.publicKey, accInfo);

  // Create ATAs and mint tokens for the user
  const { usdcATA, daiATA } = await createATAsAndFund(acc.publicKey);

  const user: User = {
    keys: acc,
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
  signerKeys: Keypair | Keypair[] = sender.keys,
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
  streamId = ids.defaultStream,
  signer = sender.keys,
  assetMint = usdc,
  depositTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<any> {
  const cancelStreamIx = await lockupProgram.methods
    .cancel(streamId)
    .accounts({
      sender: signer.publicKey,
      assetMint,
      depositTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(cancelStreamIx, signer);
}

export async function cancelToken2022(streamId: BN): Promise<any> {
  await cancel({
    streamId,
    assetMint: dai,
    depositTokenProgram: token.TOKEN_2022_PROGRAM_ID,
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
  const streamId = await nextStreamId();

  const createWithDurationsIx = await lockupProgram.methods
    .createWithDurations(
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
      streamNftMint: getStreamNftMintAddress(streamId),
      assetMint: usdc,
      recipient: recipient.keys.publicKey,
      depositTokenProgram: token.TOKEN_PROGRAM_ID,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(createWithDurationsIx);

  return streamId;
}

export async function createWithTimestamps(
  params: CreateWithTimestampsParams = {}
): Promise<{ streamId: BN; streamNftMint: PublicKey }> {
  // Create the transaction instruction
  const { txIx, streamId, streamNftMint } = await getCreateWithTimestampsIx(
    params
  );

  await buildSignAndProcessTx(txIx, sender.keys);

  return { streamId, streamNftMint };
}

export async function createWithTimestampsToken2022(): Promise<{
  streamId: BN;
  streamNftMint: PublicKey;
}> {
  return await createWithTimestamps({
    assetMint: dai,
    depositTokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export async function getCreateWithTimestampsIx(
  params: CreateWithTimestampsParams = {}
): Promise<{ txIx: TxIx; streamId: BN; streamNftMint: PublicKey }> {
  const {
    senderPubKey = sender.keys.publicKey,
    recipientPubKey = recipient.keys.publicKey,
    assetMint = usdc,
    depositTokenProgram = token.TOKEN_PROGRAM_ID,
    timestamps = defaults.timestamps(),
    depositAmount = defaults.DEPOSIT_AMOUNT,
    unlockAmounts = defaults.unlockAmounts(),
    isCancelable = true,
  } = params;

  const streamId = await nextStreamId();
  const streamNftMint = getStreamNftMintAddress(streamId);

  const txIx = await lockupProgram.methods
    .createWithTimestamps(
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
      streamNftMint,
      assetMint,
      recipient: recipientPubKey,
      depositTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  return { txIx, streamId, streamNftMint };
}

export async function initializeSablierLockup(): Promise<void> {
  const initializeIx = await lockupProgram.methods
    .initialize(feeCollector.keys.publicKey)
    .accounts({
      deployer: sender.keys.publicKey,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(initializeIx);
}

export async function renounce({
  streamId = ids.defaultStream,
  signer = sender.keys,
} = {}): Promise<any> {
  const renounceIx = await lockupProgram.methods
    .renounce(streamId)
    .accounts({
      sender: signer.publicKey,
    })
    .instruction();

  await buildSignAndProcessTx(renounceIx, signer);
}

export async function withdraw({
  streamId = ids.defaultStream,
  withdrawAmount = defaults.WITHDRAW_AMOUNT,
  signer = recipient.keys,
  withdrawalRecipient = recipient.keys.publicKey,
  assetMint = usdc,
  depositTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<any> {
  const withdrawIx = await lockupProgram.methods
    .withdraw(streamId, withdrawAmount)
    .accounts({
      signer: signer.publicKey,
      streamRecipient: recipient.keys.publicKey,
      withdrawalRecipient,
      assetMint,
      depositTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(withdrawIx, signer);
}

export async function withdrawToken2022(
  streamId: BN,
  signer: Keypair
): Promise<any> {
  await withdraw({
    streamId,
    assetMint: dai,
    signer,
    depositTokenProgram: token.TOKEN_2022_PROGRAM_ID,
  });
}

export async function withdrawMax({
  streamId = ids.defaultStream,
  signer = sender.keys.publicKey,
  withdrawalRecipient = recipient.keys.publicKey,
  assetMint = usdc,
  depositTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<any> {
  const withdrawMaxIx = await lockupProgram.methods
    .withdrawMax(streamId)
    .accounts({
      signer,
      streamRecipient: recipient.keys.publicKey,
      withdrawalRecipient,
      assetMint,
      depositTokenProgram,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(withdrawMaxIx);
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

export async function getTreasuryLamports(): Promise<bigint> {
  return await getLamportsOf(treasuryAddress);
}

export async function getTreasuryATABalanceSPL(): Promise<BN> {
  return await getATABalance(banksClient, treasuryATASpl);
}

export async function getTreasuryATABalanceToken2022(): Promise<BN> {
  return await getATABalance(banksClient, treasuryATAToken2022);
}

export function defaultStreamData({
  id = ids.defaultStream,
  isCancelable = true,
  isDepleted = false,
  wasCanceled = false,
} = {}): StreamData {
  return {
    amounts: defaults.amountsAfterCreate(),
    assetMint: usdc,
    id: id,
    isCancelable,
    isDepleted,
    timestamps: defaults.timestamps(),
    sender: sender.keys.publicKey,
    wasCanceled,
  };
}

export function defaultStreamDataToken2022({
  id = ids.defaultStream,
  isDepleted = false,
  wasCanceled = false,
} = {}): StreamData {
  const data = defaultStreamData({ id, isDepleted, wasCanceled });
  return {
    ...data,
    assetMint: dai,
  };
}

export async function fetchStreamData(
  streamId = ids.defaultStream
): Promise<any> {
  const streamDataAddress = getStreamDataAddress(streamId);
  const streamDataAccount = await banksClient.getAccount(streamDataAddress);
  if (!streamDataAccount) {
    throw new Error("Stream Data account is undefined");
  }

  // Return the Stream data decoded via the Anchor account layout
  const streamLayout = lockupProgram.account.streamData;

  return streamLayout.coder.accounts.decode(
    "streamData",
    Buffer.from(streamDataAccount.data)
  );
}

export function getPDAAddress(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey = lockupProgram.programId
): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function getStreamDataAddress(streamId: BN): PublicKey {
  const streamNftMint = getStreamNftMintAddress(streamId);
  const streamDataSeeds = [
    Buffer.from(defaults.STREAM_DATA_SEED),
    streamNftMint.toBuffer(),
  ];
  return getPDAAddress(streamDataSeeds);
}

function getStreamNftMintAddress(streamId: BN): PublicKey {
  // The seeds used when creating the Stream NFT Mint
  const streamNftMintSeeds = [
    Buffer.from(defaults.STREAM_NFT_MINT_SEED),
    streamId.toBuffer("le", 8),
  ];

  return getPDAAddress(streamNftMintSeeds);
}

async function nextStreamId(): Promise<BN> {
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
  return totalSupply.add(new BN(1));
}

async function mintTokensToUser(
  usdcATA: PublicKey,
  daiATA: PublicKey
): Promise<void> {
  // Mint SPL tokens to the user
  await mintTo(
    banksClient,
    defaultBankrunPayer,
    usdc,
    usdcATA,
    defaultBankrunPayer.publicKey,
    defaults.USDC_USER_BALANCE
  );

  // Mint Token-2022 tokens to the user
  await mintTo(
    banksClient,
    defaultBankrunPayer,
    dai,
    daiATA,
    defaultBankrunPayer.publicKey,
    defaults.DAI_USER_BALANCE,
    [],
    token.TOKEN_2022_PROGRAM_ID
  );
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
