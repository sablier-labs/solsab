import * as token from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import type BN from "bn.js";
import type { AccountInfoBytes, AddedProgram, BanksClient, ProgramTestContext } from "solana-bankrun";
import { Clock, startAnchor } from "solana-bankrun";
import { Decimals, ProgramId } from "../../lib/constants";
import { dai, sol, usdc } from "../../lib/convertors";
import { toBigInt, toBn } from "../../lib/helpers";
import type { ProgramName } from "../../lib/types";
import { createATAAndFund, createMint, transferLamports } from "./anchor-bankrun";
import { ChainlinkMock } from "./chainlink-mock";
import type { User } from "./types";

export class TestContext {
  // Core Bankrun components
  private context!: ProgramTestContext;
  public banksClient!: BanksClient;
  public bankrunProvider!: BankrunProvider;
  public defaultBankrunPayer!: Keypair;

  // Users/Others - encapsulated within the context
  public eve!: User;
  public feeCollector!: User;
  public recipient!: User;
  public treasuryAddress!: PublicKey;

  // Chainlink Mock
  public chainlinkMock: ChainlinkMock = new ChainlinkMock();

  // Tokens
  public dai!: PublicKey; // Token 2022
  public randomToken!: PublicKey; // Token standard
  public usdc!: PublicKey; // Token standard

  async setUp(
    programName: ProgramName,
    programId: PublicKey,

    addedPrograms: AddedProgram[] = [],
  ) {
    const programs = [
      { name: programName, programId },
      {
        name: "chainlink_program",
        programId: ProgramId.CHAINLINK_PROGRAM,
      },
      ...addedPrograms,
    ];

    const addedAccounts = [await this.chainlinkMock.accountData()];

    // Start Anchor context with the provided programs & accounts
    this.context = await startAnchor("", programs, addedAccounts);
    this.banksClient = this.context.banksClient;
    this.bankrunProvider = new BankrunProvider(this.context);
    this.defaultBankrunPayer = this.bankrunProvider.wallet.payer;

    // Initialize the tokens
    await this.createTokens();

    // Create the users
    this.eve = await this.createUser();
    this.feeCollector = await this.createUser();
    this.recipient = await this.createUser();
  }

  async createUser(): Promise<User> {
    // Create the keypair for the user
    const acc = await this.createAccount();

    // Create ATAs and mint tokens for the user
    const { usdcATA, daiATA } = await this.createATAsAndFund(acc.publicKey);

    return {
      daiATA,
      keys: acc,
      usdcATA,
    };
  }

  async createAccount(): Promise<Keypair> {
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
    this.context.setAccount(acc.publicKey, accInfo);

    return acc;
  }

  /*//////////////////////////////////////////////////////////////////////////
                                    HELPERS
  //////////////////////////////////////////////////////////////////////////*/

  async accountExists(address: PublicKey): Promise<boolean> {
    return (await this.banksClient.getAccount(address)) !== null;
  }

  async getLamportsOf(user: PublicKey): Promise<BN> {
    const balance = await this.banksClient.getBalance(user);
    return toBn(balance);
  }

  async simulateFeeGeneration(): Promise<BN> {
    const fees = sol(1);

    await transferLamports(
      this.banksClient,
      this.defaultBankrunPayer,
      this.defaultBankrunPayer.publicKey,
      this.treasuryAddress,
      fees.toNumber(),
    );

    return fees;
  }

  async timeTravelTo(timestamp: BN) {
    const currentClock = await this.banksClient.getClock();

    this.context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        toBigInt(timestamp),
      ),
    );
  }

  /*//////////////////////////////////////////////////////////////////////////
                                PRIVATE METHODS
  //////////////////////////////////////////////////////////////////////////*/

  private async createATAsAndFund(user: PublicKey): Promise<{ usdcATA: PublicKey; daiATA: PublicKey }> {
    // Create ATAs for the user
    const usdcATA = await createATAAndFund(
      this.banksClient,
      this.defaultBankrunPayer,
      this.usdc,
      usdc(1_000_000),
      token.TOKEN_PROGRAM_ID,
      user,
    );
    const daiATA = await createATAAndFund(
      this.banksClient,
      this.defaultBankrunPayer,
      this.dai,
      dai(1_000_000),
      token.TOKEN_2022_PROGRAM_ID,
      user,
    );

    return { daiATA, usdcATA };
  }

  private async createTokens(): Promise<void> {
    const mintAndFreezeAuthority = this.defaultBankrunPayer.publicKey;

    this.dai = await createMint(
      this.banksClient,
      this.defaultBankrunPayer,
      mintAndFreezeAuthority,
      mintAndFreezeAuthority,
      Decimals.DAI,
      Keypair.generate(),
      token.TOKEN_2022_PROGRAM_ID,
    );

    const randomTokenDecimals = 6;
    this.randomToken = await createMint(
      this.banksClient,
      this.defaultBankrunPayer,
      mintAndFreezeAuthority,
      mintAndFreezeAuthority,
      randomTokenDecimals,
      Keypair.generate(),
      token.TOKEN_PROGRAM_ID,
    );

    this.usdc = await createMint(
      this.banksClient,
      this.defaultBankrunPayer,
      mintAndFreezeAuthority,
      mintAndFreezeAuthority,
      Decimals.USDC,
      Keypair.generate(),
      token.TOKEN_PROGRAM_ID,
    );
  }
}
