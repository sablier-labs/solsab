import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction as TxIx,
  ComputeBudgetProgram,
  SystemProgram,
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

// Programs and addresses
export let banksClient: BanksClient;
let bankrunProvider: BankrunProvider;
let context: ProgramTestContext;
export let nftCollectionDataAddress: PublicKey;
export let lockupProgram: Program<SablierLockup>;
export let streamNftMintAddress: PublicKey;
export let treasuryAddress: PublicKey;

// Users
export let eve: User;
export let feeCollector: User;
export let recipient: User;
export let sender: User;

// Tokens
export let usdc: PublicKey;
export let dai: PublicKey;

// StreamIds
export let ids: StreamIds;

export async function setUp(initOrNo = true) {
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

  // Deploy the testing program
  lockupProgram = new Program<SablierLockup>(IDL, bankrunProvider);

  // Create the sender user with the provider's wallet
  sender = {
    keys: bankrunProvider.wallet.payer,
    usdcATA: Keypair.generate().publicKey,
    daiATA: Keypair.generate().publicKey,
  };

  // create the tokens:
  const { usdc: createdUsdc, dai: createdDai } = await createTokensMint();
  usdc = createdUsdc;
  dai = createdDai;

  // Create and assign ATAs for sender
  sender.usdcATA = await createATA(
    sender.keys.publicKey,
    usdc,
    token.TOKEN_PROGRAM_ID
  );
  sender.daiATA = await createATA(
    sender.keys.publicKey,
    dai,
    token.TOKEN_2022_PROGRAM_ID
  );

  await mintTokensToUser(sender.usdcATA, sender.daiATA);

  // Create the users
  eve = await createUser();
  feeCollector = await createUser();
  recipient = await createUser();

  // Pre-calculate the address of the NFT Collection Data
  nftCollectionDataAddress = getPDAAddress([
    Buffer.from(defaults.NFT_COLLECTION_DATA_SEED),
  ]);

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress([Buffer.from(defaults.TREASURY_SEED)]);

  // Set the block time to APR 1, 2025
  await timeTravelTo(defaults.APR_1_2025);

  if (initOrNo) {
    // Initialize the SablierLockup program
    await initializeSablierLockup();

    // Create the default streams
    ids = {
      defaultStream: (await createWithTimestamps()).streamId,
      notCancelableStream: (
        await createWithTimestamps({
          isCancelable: false,
        })
      ).streamId,
      nullStream: new BN(1729),
    };
  }
}

/*//////////////////////////////////////////////////////////////////////////
                                    TX-IX
//////////////////////////////////////////////////////////////////////////*/

async function buildSignAndProcessTx(
  ixs: TxIx | TxIx[],
  signerKeys: Keypair = sender.keys,
  cuLimit: number = 1_400_000
) {
  // Get the latest blockhash
  const res = await banksClient.getLatestBlockhash();
  if (!res) throw new Error("Couldn't get the latest blockhash");

  // Initialize transaction
  const tx = new Transaction();
  tx.recentBlockhash = res[0];

  // Add compute unit limit instruction if specified
  if (cuLimit !== undefined) {
    const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: cuLimit,
    });
    tx.add(cuLimitIx);
  }

  // Add instructions to transaction
  const internal_ixs: TxIx[] = Array.isArray(ixs) ? ixs : [ixs];
  internal_ixs.forEach((ix) => tx.add(ix));

  // Sign transaction
  tx.sign(signerKeys);

  // Process transaction
  const txMeta = await banksClient.processTransaction(tx);

  return txMeta;
}

export async function cancel({
  streamId = ids.defaultStream,
  _sender = sender.keys.publicKey,
  assetMint = usdc,
  depositTokenProgram = token.TOKEN_PROGRAM_ID,
} = {}): Promise<any> {
  const cancelStreamIx = await lockupProgram.methods
    .cancel(streamId)
    .accounts({
      sender: _sender,
      assetMint,
      depositTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(cancelStreamIx);
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

  const createWithDurationIx = await lockupProgram.methods
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
    .accountsPartial({
      sender: sender.keys.publicKey,
      streamNftMint: getStreamNftMintAddress(streamId),
      assetMint: usdc,
      recipient: recipient.keys.publicKey,
      depositTokenProgram: token.TOKEN_PROGRAM_ID,
      nftTokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .instruction();

  await buildSignAndProcessTx(createWithDurationIx);

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
    .accountsPartial({
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

// it("Initializes the program", async () => {
export async function renounce({
  streamId = ids.defaultStream,
  signer = sender.keys,
} = {}): Promise<any> {
  const renounceIx = await lockupProgram.methods
    .renounce(streamId)
    .accounts({
      sender: sender.keys.publicKey,
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
  signer: PublicKey
): Promise<any> {
  await withdraw({
    streamId,
    assetMint: dai,
    signer: signer,
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

// Helper functions
async function createATA(
  owner: PublicKey,
  mint: PublicKey,
  programId: PublicKey
): Promise<PublicKey> {
  // Find the associated token address
  const ata = deriveATAAddress(mint, owner, programId);

  // Create associated token account instruction
  const tx = new Transaction().add(
    token.createAssociatedTokenAccountInstruction(
      sender.keys.publicKey,
      ata,
      owner,
      mint,
      programId
    )
  );

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())![0];
  tx.sign(sender.keys);

  await banksClient.processTransaction(tx);
  return ata;
}

export async function createTokenMint(
  decimals: number = 9,
  programId: PublicKey = token.TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  const rent = await banksClient.getRent();

  const tx = new Transaction().add(
    // Create the account - authority is the payer
    SystemProgram.createAccount({
      fromPubkey: sender.keys.publicKey,
      newAccountPubkey: mint,
      space: token.MINT_SIZE,
      lamports: Number(rent.minimumBalance(BigInt(token.MINT_SIZE))),
      programId,
    }),

    token.createInitializeMint2Instruction(
      mint,
      decimals,
      sender.keys.publicKey,
      sender.keys.publicKey,
      programId
    )
  );

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())![0];
  tx.sign(sender.keys, mintKeypair);

  await banksClient.processTransaction(tx);

  return mint;
}

async function createTokensMint(): Promise<{
  usdc: PublicKey;
  dai: PublicKey;
}> {
  return {
    usdc: await createTokenMint(6, token.TOKEN_PROGRAM_ID),
    dai: await createTokenMint(9, token.TOKEN_2022_PROGRAM_ID),
  };
}

async function createUser(): Promise<User> {
  // Create the base keypair for the user's address
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

  // Create ATAs for the user
  const usdcATA = await createATA(acc.publicKey, usdc, token.TOKEN_PROGRAM_ID);
  const daiATA = await createATA(
    acc.publicKey,
    dai,
    token.TOKEN_2022_PROGRAM_ID
  );

  const user: User = {
    keys: acc,
    usdcATA,
    daiATA,
  };

  // Mint some tokens to the user's accounts
  await mintTokensToUser(usdcATA, daiATA);

  return user;
}

export async function defaultStreamData({
  id = ids.defaultStream,
  isCancelable = true,
  isDepleted = false,
  wasCanceled = false,
} = {}): Promise<StreamData> {
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
} = {}): Promise<StreamData> {
  return defaultStreamData({ id, isDepleted, wasCanceled }).then((data) => ({
    ...data,
    assetMint: dai,
  }));
}

export function deriveATAAddress(
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey = token.TOKEN_PROGRAM_ID
): PublicKey {
  return token.getAssociatedTokenAddressSync(mint, owner, true, programId);
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

export async function getATABalance(ataAddress: PublicKey): Promise<BN> {
  const ataAccount = await banksClient.getAccount(ataAddress);
  if (!ataAccount) {
    throw new Error("ataAccount does not exist");
  }

  const accountData = token.AccountLayout.decode(ataAccount.data);
  return new BN(accountData.amount.toString());
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

export async function lastStreamId(): Promise<BN> {
  const nextId = await nextStreamId();
  return nextId.sub(new BN(1));
}

async function nextStreamId(): Promise<BN> {
  const nftCollectionDataAcc = await banksClient.getAccount(
    nftCollectionDataAddress
  );

  if (!nftCollectionDataAcc) {
    throw new Error("NFT Collection Data account is undefined");
  }

  // Return the NFT Collection Data decoded via the Anchor account layout
  const nftCollectionDataLayout =
    lockupProgram.account.nftCollectionData.coder.accounts.decode(
      "nftCollectionData",
      Buffer.from(nftCollectionDataAcc.data)
    );

  const totalSupply = new BN(
    nftCollectionDataLayout.totalSupply.toString(),
    10
  );

  return totalSupply.add(new BN(1));
}

async function mintTokensToUser(
  usdcATA: PublicKey,
  daiATA: PublicKey
): Promise<void> {
  // 1M of tokens
  const amountUsdc = 1_000_000e6;
  const amountDai = 1_000_000e9;

  // Mint SPL tokens to the user
  const splMintTx = new Transaction().add(
    token.createMintToInstruction(
      usdc,
      usdcATA,
      sender.keys.publicKey,
      amountUsdc,
      [],
      token.TOKEN_PROGRAM_ID
    )
  );
  splMintTx.recentBlockhash = (await banksClient.getLatestBlockhash())![0];
  splMintTx.sign(sender.keys);
  await banksClient.processTransaction(splMintTx);

  // Mint Token-2022 tokens to the user
  const token2022MintTx = new Transaction().add(
    token.createMintToInstruction(
      dai,
      daiATA,
      sender.keys.publicKey,
      amountDai,
      [],
      token.TOKEN_2022_PROGRAM_ID
    )
  );
  token2022MintTx.recentBlockhash =
    (await banksClient.getLatestBlockhash())![0];
  token2022MintTx.sign(sender.keys);

  await banksClient.processTransaction(token2022MintTx);
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
