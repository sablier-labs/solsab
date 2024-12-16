import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  BanksClient,
  Clock,
  ProgramTestContext,
  startAnchor,
} from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";

import {
  createMint,
  createAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  getTokenBalance,
  TOKEN_PROGRAM_ID,
} from "./anchor-bankrun-adapter";

import {
  confirmTransaction,
  // createAccountsMintsAndTokenAccounts,
  // makeKeypairs,
} from "@solana-developers/helpers";

import { Solsab } from "../target/types/solsab";
import { before } from "mocha";

const web3 = anchor.web3;

describe("solsab", () => {
  let context: ProgramTestContext;
  let connection: Connection;
  let client: BanksClient;
  let sender: anchor.web3.Keypair;
  let provider: BankrunProvider;

  const program = anchor.workspace.solsab as anchor.Program<Solsab>;
  const SOLSAB_PROGRAM_ID = program.programId;

  let treasuryPDA: anchor.web3.PublicKey;

  before(async () => {
    // Configure the testing environment
    context = await startAnchor("", [], []);
    client = context.banksClient;
    provider = new BankrunProvider(context);

    anchor.setProvider(provider);
    connection = anchor.getProvider().connection;

    // Output the sender's public key
    sender = provider.wallet.payer;
    console.log(`Sender: ${sender.publicKey}`);

    // Output the sender's SOL balance
    const balanceInSOL =
      (await client.getBalance(sender.publicKey)) /
      BigInt(web3.LAMPORTS_PER_SOL);
    const formattedBalance = new Intl.NumberFormat().format(balanceInSOL);
    console.log(`Balance: ${formattedBalance} SOL`);
  });

  // TODO: refactor the `stream: any` into just `any`
  async function fetchStream(
    senderATA: PublicKey,
    recipientATA: PublicKey
  ): Promise<{ stream: any }> {
    // The seeds used when creating the Stream PDA
    const seeds = [
      Buffer.from("LL_stream"),
      Buffer.from(senderATA.toBytes()),
      Buffer.from(recipientATA.toBytes()),
    ];

    const [pdaAddress] = PublicKey.findProgramAddressSync(
      seeds,
      SOLSAB_PROGRAM_ID
    );

    const streamAccount = await client.getAccount(pdaAddress);
    // Decode the raw bytes using the Anchor account layout
    if (!streamAccount) {
      throw new Error("Stream account data is undefined");
    }

    const streamLayout = program.account.stream;
    const decodedStreamAccount = streamLayout.coder.accounts.decode(
      "stream",
      Buffer.from(streamAccount.data)
    );

    return { stream: decodedStreamAccount };
  }

  async function createCancelableLockupLinearStream(): Promise<{
    stream: any;
    senderATA: PublicKey;
    recipientATA: PublicKey;
    tokenMint: anchor.web3.PublicKey;
    streamedAmount: anchor.BN;
    streamMilestones: StreamMilestones;
  }> {
    const TOKEN_DECIMALS = 2;
    const freezeAuthority = null;

    const tokenMint = await createMint(
      client,
      sender,
      sender.publicKey,
      freezeAuthority,
      TOKEN_DECIMALS
    );

    const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, TOKEN_DECIMALS);

    const senderATA = await createAssociatedTokenAccount(
      client,
      sender,
      tokenMint,
      sender.publicKey
    );
    console.log(`Sender's ATA: ${senderATA}`);

    const mintTxSig = await mintTo(
      client,
      sender,
      tokenMint,
      senderATA,
      sender,
      10 * MINOR_UNITS_PER_MAJOR_UNITS
    );

    console.log(
      `Minted ${10 * MINOR_UNITS_PER_MAJOR_UNITS} tokens to the Sender ATA`
    );

    const recipient = anchor.web3.Keypair.generate();
    const recipientATA = await createAssociatedTokenAccount(
      client,
      sender,
      tokenMint,
      recipient.publicKey
    );
    console.log(`Recipient's ATA: ${recipientATA}`);

    const streamedAmount = new anchor.BN(6);
    const streamMilestones = generateStandardStreamMilestones();
    const isCancelable = true;

    const tx = await initializeTx().then((tx) => tx);

    let createStreamIx = await program.methods
      .createLockupLinearStream(
        streamMilestones.startTime,
        streamMilestones.cliffTime,
        streamMilestones.endTime,
        streamedAmount,
        isCancelable
      )
      .accounts({
        sender: sender.publicKey,
        mint: tokenMint,
        recipient: recipient.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    tx.add(createStreamIx);
    tx.sign(sender);

    await client.processTransaction(tx);

    // Fetch the created Stream
    const stream = (await fetchStream(senderATA, recipientATA)).stream;

    return {
      stream,
      senderATA,
      recipientATA,
      tokenMint,
      streamedAmount: streamedAmount,
      streamMilestones,
    };
  }

  async function initializeTx(): Promise<anchor.web3.Transaction> {
    let tx = new anchor.web3.Transaction();

    const res = await client.getLatestBlockhash();
    if (!res) throw new Error("Couldn't get the latest blockhash");

    tx.recentBlockhash = res[0];
    return tx;
  }

  it("initializes the SolSab program", async () => {
    // Pre-calculate the PDA address for the treasury
    [treasuryPDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    console.log("Treasury's PDA address: ", treasuryPDA.toBase58());

    const tx = await initializeTx().then((tx) => tx);

    let initializeIx = await program.methods
      .initialize()
      .accounts({
        signer: sender.publicKey,
      })
      .instruction();

    tx.add(initializeIx);
    tx.sign(sender);

    await client.processTransaction(tx);

    // Make sure the program is properly initialized
    // Confirm that the treasury PDA account was created and has expected properties
    const treasuryAccount = await client.getAccount(treasuryPDA);
    assert.ok(treasuryAccount, "Treasury PDA not initialized");
  });

  it("Creates a LockupLinear Stream", async () => {
    const { stream, tokenMint, streamedAmount } =
      await createCancelableLockupLinearStream();

    // Derive the Treasury's ATA address
    const treasuryATA = getAssociatedTokenAddressSync(
      tokenMint,
      treasuryPDA,
      true
    );

    // Assert that the Treasury ATA contains the deposited tokens
    const treasuryATAData = (await client.getAccount(treasuryATA))?.data;
    assert.ok(treasuryATAData, "Treasury ATA data is undefined");

    const treasuryBalance = new anchor.BN(getTokenBalance(treasuryATAData));

    assert(
      treasuryBalance.eq(streamedAmount),
      "Treasury hasn't received the sender's tokens"
    );

    assert(
      stream.isCancelable === true,
      "The created Stream is non-cancelable"
    );
  });

  it("Renounces the cancelability of a LockupLinear Stream", async () => {
    const { stream, senderATA, recipientATA } =
      await createCancelableLockupLinearStream();

    const tx = await initializeTx().then((tx) => tx);

    let renounceStreamIx = await program.methods
      .renounceStreamCancelability()
      .accounts({
        sender: sender.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
      })
      .instruction();

    tx.add(renounceStreamIx);
    tx.sign(sender);
    await client.processTransaction(tx);

    assert(stream.isCancelable === true, "The Stream couldn't be renounced");
  });

  it("Cancels a LockupLinear Stream immediately after creating it", async () => {
    const { senderATA, recipientATA, tokenMint, streamedAmount } =
      await createCancelableLockupLinearStream();

    const tx = await initializeTx().then((tx) => tx);

    let cancelStreamIx = await program.methods
      .cancelLockupLinearStream()
      .accounts({
        sender: sender.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    tx.add(cancelStreamIx);
    tx.sign(sender);
    await client.processTransaction(tx);

    const stream = (await fetchStream(senderATA, recipientATA)).stream;

    assert(
      stream.wasCanceled === true && stream.isCancelable === false,
      "The Stream couldn't be canceled"
    );

    assert(
      stream.amounts.refunded.eq(streamedAmount),
      "The Stream's refunded amount is incorrect"
    );

    assert(
      stream.amounts.withdrawn.eq(new anchor.BN(0)),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it.skip("Cancels a LockupLinear Stream after the tokens have been fully streamed", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      streamedAmount,
      streamMilestones,
    } = await createCancelableLockupLinearStream();

    const currentClock = await client.getClock();
    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        currentClock.unixTimestamp + BigInt(streamMilestones.endTime.toNumber())
      )
    );

    let cancelStreamTxSig = await program.methods
      .cancelLockupLinearStream()
      .accounts({
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([sender])
      .rpc();

    await confirmTransaction(connection, cancelStreamTxSig, `processed`);

    const stream = (await fetchStream(senderATA, recipientATA)).stream;

    assert(
      stream.wasCanceled === true && stream.isCancelable === false,
      "The Stream couldn't be canceled"
    );

    assert(
      stream.amounts.refunded === 0,
      "The Stream's refunded amount is incorrect"
    );

    assert(
      stream.amounts.withdrawn === streamedAmount,
      "The Stream's withdrawn amount is incorrect"
    );
  });

  // HELPER FUNCTIONS AND DATA STRUCTS

  interface StreamMilestones {
    startTime: anchor.BN;
    cliffTime: anchor.BN;
    endTime: anchor.BN;
  }

  function generateStandardStreamMilestones(): StreamMilestones {
    const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
    const startTime = new anchor.BN(now + 60); // Start in 1 minute
    const cliffTime = new anchor.BN(now + 300); // Cliff in 5 minutes
    const endTime = new anchor.BN(now + 3600); // End in 1 hour

    return {
      startTime,
      cliffTime,
      endTime,
    };
  }
});
