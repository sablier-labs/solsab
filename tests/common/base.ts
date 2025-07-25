import * as token from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import BN from "bn.js";
import _ from "lodash";
import { type AccountInfoBytes, type BanksClient, Clock, type ProgramTestContext, startAnchor } from "solana-bankrun";
import { sol, toBigInt, toBn } from "../../lib/helpers";
import { type ProgramName } from "../../lib/types";
import { createATAAndFund, createMint } from "./anchor-bankrun";
import { type User } from "./types";

/* -------------------------------------------------------------------------- */
/*                              CONFIG VARIABLES                              */
/* -------------------------------------------------------------------------- */

export let banksClient: BanksClient;
export let bankrunProvider: BankrunProvider;
export let context: ProgramTestContext;
export let defaultBankrunPayer: Keypair;

/* -------------------------------------------------------------------------- */
/*                                    USERS                                   */
/* -------------------------------------------------------------------------- */

export let eve: User;
export let feeCollector: User;
export let recipient: User;

/* -------------------------------------------------------------------------- */
/*                                   TOKENS                                   */
/* -------------------------------------------------------------------------- */

export let usdc: PublicKey;
export let dai: PublicKey;
export let randomToken: PublicKey;

/* -------------------------------------------------------------------------- */
/*                                  FUNCTIONS                                 */
/* -------------------------------------------------------------------------- */

export async function setUp(
  programName: ProgramName,
  programId: PublicKey,
  additionalPrograms: { name: string; programId: PublicKey }[] = [],
) {
  const programs = [{ name: programName, programId }, ...additionalPrograms];

  // Start Anchor context with the provided programs
  context = await startAnchor("", programs, []);
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

async function createATAsAndFund(user: PublicKey): Promise<{ usdcATA: PublicKey; daiATA: PublicKey }> {
  const USDC_USER_BALANCE = new BN(1_000_000e6); // 1M tokens
  const DAI_USER_BALANCE = new BN(1_000_000e9); // 1M tokens
  // Create ATAs for the user
  const usdcATA = await createATAAndFund(
    banksClient,
    defaultBankrunPayer,
    usdc,
    USDC_USER_BALANCE,
    token.TOKEN_PROGRAM_ID,
    user,
  );
  const daiATA = await createATAAndFund(
    banksClient,
    defaultBankrunPayer,
    dai,
    DAI_USER_BALANCE,
    token.TOKEN_2022_PROGRAM_ID,
    user,
  );

  return { daiATA, usdcATA };
}

async function createTokens(): Promise<void> {
  const mintAndFreezeAuthority = defaultBankrunPayer.publicKey;

  const daiDecimals = 9;
  dai = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    daiDecimals,
    Keypair.generate(),
    token.TOKEN_2022_PROGRAM_ID,
  );

  const randomTokenDecimals = 6;
  randomToken = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    randomTokenDecimals,
    Keypair.generate(),
    token.TOKEN_PROGRAM_ID,
  );

  const usdcDecimals = 6;
  usdc = await createMint(
    banksClient,
    defaultBankrunPayer,
    mintAndFreezeAuthority,
    mintAndFreezeAuthority,
    usdcDecimals,
    Keypair.generate(),
    token.TOKEN_PROGRAM_ID,
  );
}

export async function createUser(): Promise<User> {
  // Create the keypair for the user
  const acc = Keypair.generate();

  // Set up the account info for the new keypair
  const accInfo: AccountInfoBytes = {
    data: new Uint8Array(), // Empty data
    executable: false, // Not a program account
    lamports: sol(100).toNumber(), // Default balance (100 SOL)
    owner: new PublicKey("11111111111111111111111111111111"), // Default owner (System Program)
    rentEpoch: 0, // Default rent epoch
  };

  // Add account to the BanksClient context
  context.setAccount(acc.publicKey, accInfo);

  // Create ATAs and mint tokens for the user
  const { usdcATA, daiATA } = await createATAsAndFund(acc.publicKey);

  return {
    daiATA,
    keys: acc,
    usdcATA,
  };
}

/*//////////////////////////////////////////////////////////////////////////
                                  HELPERS
//////////////////////////////////////////////////////////////////////////*/

export async function accountExists(address: PublicKey): Promise<boolean> {
  return (await banksClient.getAccount(address)) !== null;
}

/**
 * Get the hex code for a given error name from an error code object
 * @param errorCodeObj The error code object/enum
 * @param errorName The name of the error
 * @returns The hex code for the error
 */
export function getErrorCode<T extends Record<string, number>>(errorCodeObj: T, errorName: string): string {
  const errorCode = errorCodeObj[errorName as keyof T];
  return `0x${errorCode.toString(16)}`;
}

/**
 * Get the error name for a given hex code from an error code object
 * @param errorCodeObj The error code object/enum
 * @param hexCode The hex code of the error (e.g., "0x177e")
 * @returns The error name
 */
export function getErrorName<T extends Record<string, number>>(errorCodeObj: T, hexCode: string): string {
  // Convert the hex string to a number
  const numericCode = parseInt(hexCode, 16);

  // Find the error name by value
  for (const [key, value] of _.entries(errorCodeObj)) {
    // Skip numeric keys (TypeScript enums have reverse mappings)
    if (_.isNumber(key)) {
      continue;
    }

    if (value === numericCode) {
      return key;
    }
  }

  return "not found";
}

export async function getLamportsOf(user: PublicKey): Promise<BN> {
  const balance = await banksClient.getBalance(user);
  return toBn(balance);
}

export async function timeTravelTo(timestamp: BN) {
  const currentClock = await banksClient.getClock();

  context.setClock(
    new Clock(
      currentClock.slot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      toBigInt(timestamp),
    ),
  );
}
