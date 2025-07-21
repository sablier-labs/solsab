import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Cluster,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import {
  BanksClient,
  Clock,
  ProgramTestContext,
  startAnchor,
  AddedAccount,
  AddedProgram,
  AccountInfoBytes,
} from "solana-bankrun";

import { createATAAndFund, createMint } from "./anchor-bankrun-adapter";

// Config variables
export let banksClient: BanksClient;
export let bankrunProvider: BankrunProvider;
export let context: ProgramTestContext;
export let defaultBankrunPayer: Keypair;

// Users
export let eve: User;
export let feeCollector: User;
export let recipient: User;

// Tokens
export let usdc: PublicKey;
export let dai: PublicKey;
export let randomToken: PublicKey;

// Constants
export const CHAINLINK_PROGRAM_ID = new PublicKey(
  "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny"
);

export const CHAINLINK_SOL_USD_FEED_ID = new PublicKey(
  "99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR"
);

export async function setUp(
  programName: string,
  programId: PublicKey,
  addedPrograms: AddedProgram[] = [],
  addedAccountIds: PublicKey[] = []
) {
  const programs = [
    { name: programName, programId },
    {
      name: "chainlink_program",
      programId: CHAINLINK_PROGRAM_ID,
    },
    ...addedPrograms,
  ];
  const addedAccounts = await Promise.all(
    addedAccountIds.map((id) => fetchAccountDataAsFixture(id.toString()))
  );

  // Add the Chainlink SOL/USD price feed to the Added Accounts list
  addedAccounts.push(
    await fetchAccountDataAsFixture(CHAINLINK_SOL_USD_FEED_ID.toString())
  );

  // Start Anchor context with the provided programs & accounts
  context = await startAnchor("", programs, addedAccounts);
  banksClient = context.banksClient;
  bankrunProvider = new BankrunProvider(context);
  defaultBankrunPayer = bankrunProvider.wallet.payer;

  // Initialize the tokens
  await createTokens();

  // Create the users
  eve = await createUser();
  feeCollector = await createUser();
  recipient = await createUser();
}

async function createATAsAndFund(
  user: PublicKey
): Promise<{ usdcATA: PublicKey; daiATA: PublicKey }> {
  const USDC_USER_BALANCE = 1_000_000e6; // 1M tokens
  const DAI_USER_BALANCE = 1_000_000e9; // 1M tokens
  // Create ATAs for the user
  const usdcATA = await createATAAndFund(
    banksClient,
    defaultBankrunPayer,
    usdc,
    USDC_USER_BALANCE,
    token.TOKEN_PROGRAM_ID,
    user
  );
  const daiATA = await createATAAndFund(
    banksClient,
    defaultBankrunPayer,
    dai,
    DAI_USER_BALANCE,
    token.TOKEN_2022_PROGRAM_ID,
    user
  );

  return { usdcATA, daiATA };
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

export async function createUser(): Promise<User> {
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
                                  HELPERS
//////////////////////////////////////////////////////////////////////////*/

export async function accountExists(address: PublicKey): Promise<boolean> {
  return (await banksClient.getAccount(address)) != null;
}

export async function fetchAccountDataAsFixture(
  address: string,
  cluster: Cluster = "devnet"
): Promise<AddedAccount> {
  const connection = new Connection(clusterApiUrl(cluster), "confirmed");
  const accountId = new PublicKey(address);

  const raw = await connection.getAccountInfo(accountId);
  if (!raw) {
    throw new Error(`Account not found: ${address}`);
  }

  return {
    address: accountId,
    info: {
      executable: raw.executable,
      lamports: raw.lamports,
      owner: raw.owner,
      data: new Uint8Array(raw.data),
    },
  };
}

/**
 * Get the hex code for a given error name from an error code object
 * @param errorCodeObj The error code object/enum
 * @param errorName The name of the error
 * @returns The hex code for the error
 */
export function getErrorCode<T extends Record<string, number>>(
  errorCodeObj: T,
  errorName: string
): string {
  const errorCode = errorCodeObj[errorName as keyof T];
  return `0x${errorCode.toString(16)}`;
}

/**
 * Get the error name for a given hex code from an error code object
 * @param errorCodeObj The error code object/enum
 * @param hexCode The hex code of the error (e.g., "0x177e")
 * @returns The error name
 */
export function getErrorName<T extends Record<string, number>>(
  errorCodeObj: T,
  hexCode: string
): string {
  // Convert the hex string to a number
  const numericCode = parseInt(hexCode, 16);

  // Find the error name by value
  for (const [key, value] of Object.entries(errorCodeObj)) {
    // Skip numeric keys (TypeScript enums have reverse mappings)
    if (!isNaN(Number(key))) continue;

    if (value === numericCode) {
      return key;
    }
  }

  return "not found";
}

export async function getLamportsOf(user: PublicKey): Promise<bigint> {
  return await banksClient.getBalance(user);
}

export function getPDAAddress(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
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

export interface User {
  keys: Keypair;
  daiATA: PublicKey;
  usdcATA: PublicKey;
}
