import {
  PublicKey,
  Keypair,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction as TxIx,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
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
  StreamMilestones,
  generateStandardStreamMilestones,
  getDefaultAccountInfoWithSOL,
} from "./utils";

//import * as helpers from "@solana-developers/helpers";

import { Solsab } from "../target/types/solsab";
import { before } from "mocha";

describe("solsab", () => {
  let context: ProgramTestContext;
  let client: BanksClient;
  let sender: Keypair;
  let recipient: Keypair;
  let provider: BankrunProvider;
  let treasuryPDA: PublicKey;

  const program = anchor.workspace.solsab as anchor.Program<Solsab>;
  const SOLSAB_PROGRAM_ID = program.programId;

  beforeEach(async () => {
    // Configure the testing environment
    context = await startAnchor("", [], []);
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    client = context.banksClient;

    // Initialize the sender and recipient accounts
    sender = provider.wallet.payer;
    recipient = await generateAccWithSOL(context);

    // Output the sender's public key
    console.log(`Sender: ${sender.publicKey}`);

    // Output the sender's SOL balance
    const sendersBalance =
      (await client.getBalance(sender.publicKey)) / BigInt(LAMPORTS_PER_SOL);
    console.log(`Sender's balance: ${sendersBalance.toString()} SOL`);

    // Output the recipient's public key
    console.log(`Recipient: ${recipient.publicKey}`);

    // Output the recipient's SOL balance
    const recipientsBalance =
      (await client.getBalance(recipient.publicKey)) / BigInt(LAMPORTS_PER_SOL);
    console.log(`Recipient's balance: ${recipientsBalance.toString()} SOL`);

    // Pre-calculate the PDA address for the treasury
    [treasuryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      SOLSAB_PROGRAM_ID
    );

    console.log("Treasury's PDA address: ", treasuryPDA.toBase58());

    let initializeIx = await program.methods
      .initialize()
      .accounts({
        signer: sender.publicKey,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(initializeIx, sender);

    // Make sure the program is properly initialized
    // Confirm that the treasury PDA account was created and has expected properties
    const treasuryAccount = await client.getAccount(treasuryPDA);
    assert.ok(treasuryAccount, "Treasury PDA not initialized");
  });

  it("Creates a LockupLinear Stream", async () => {
    const {
      senderATA,
      recipientATA,
      stream,
      tokenMint,
      depositedAmount,
      streamMilestones: milestones,
    } = await createCancelableLockupLinearStream();

    assert(
      stream.senderAta.equals(senderATA) &&
        stream.recipientAta.equals(recipientATA) &&
        stream.tokenMintAccount.equals(tokenMint) &&
        stream.isCancelable === true &&
        stream.wasCanceled === false,
      "The state of the created Stream is wrong"
    );

    assert(
      stream.amounts.deposited.eq(depositedAmount) &&
        stream.amounts.withdrawn.eq(new BN(0)) &&
        stream.amounts.refunded.eq(new BN(0)),
      "The created Stream's amounts are incorrect"
    );

    assert(
      stream.milestones.startTime.eq(milestones.startTime) &&
        stream.milestones.cliffTime.eq(milestones.cliffTime) &&
        stream.milestones.endTime.eq(milestones.endTime),
      "The created Stream's milestones are incorrect"
    );

    // Derive the Treasury's ATA address
    const treasuryATA = getAssociatedTokenAddressSync(
      tokenMint,
      treasuryPDA,
      true
    );

    // Assert that the Treasury ATA contains the deposited tokens
    const treasuryATAData = (await client.getAccount(treasuryATA))?.data;
    assert.ok(treasuryATAData, "Treasury ATA data is undefined");

    const treasuryBalance = new BN(getTokenBalance(treasuryATAData));

    assert(
      treasuryBalance.eq(depositedAmount),
      "Treasury hasn't received the sender's tokens"
    );
  });

  it("Renounces the cancelability of a LockupLinear Stream", async () => {
    const { stream, senderATA, recipientATA } =
      await createCancelableLockupLinearStream();

    let renounceStreamIx = await program.methods
      .renounceStreamCancelability()
      .accounts({
        sender: sender.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(renounceStreamIx, sender);

    assert(stream.isCancelable === true, "The Stream couldn't be renounced");
  });

  it("Cancels a LockupLinear Stream immediately after creating it", async () => {
    const { senderATA, recipientATA, tokenMint, depositedAmount } =
      await createCancelableLockupLinearStream();

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

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(cancelStreamIx, sender);

    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.wasCanceled === true && stream.isCancelable === false,
      "The Stream couldn't be canceled"
    );

    assert(
      stream.amounts.refunded.eq(depositedAmount),
      "The Stream's refunded amount is incorrect"
    );

    assert(
      stream.amounts.withdrawn.eq(new BN(0)),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Cancels a LockupLinear Stream after a half of the tokens has been streamed", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      depositedAmount,
      streamMilestones,
    } = await createCancelableLockupLinearStream();

    await timeTravelForwardTo(
      BigInt(
        streamMilestones.startTime
          .add(streamMilestones.endTime)
          .div(new BN(2))
          .toString()
      )
    );

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

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(cancelStreamIx, sender);

    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.wasCanceled === true && stream.isCancelable === false,
      "The Stream couldn't be canceled"
    );

    const expectedWithdrawnAmount = depositedAmount.div(new BN(2));

    assert(
      stream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );

    assert(
      stream.amounts.refunded.eq(depositedAmount.sub(expectedWithdrawnAmount)),
      "The Stream's refunded amount is incorrect"
    );
  });

  it("Cancels a LockupLinear Stream after the tokens have been fully streamed", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      depositedAmount: streamedAmount,
      streamMilestones,
    } = await createCancelableLockupLinearStream();

    await timeTravelForwardTo(BigInt(streamMilestones.endTime.toString()));

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

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(cancelStreamIx, sender);

    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.wasCanceled === true && stream.isCancelable === false,
      "The Stream couldn't be canceled"
    );

    assert(
      stream.amounts.refunded.eq(new BN(0)),
      "The Stream's refunded amount is incorrect"
    );

    assert(
      stream.amounts.withdrawn.eq(streamedAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Withdraws from a LockupLinear Stream at the end time", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      streamMilestones,
      depositedAmount,
    } = await createCancelableLockupLinearStream();

    await timeTravelForwardTo(BigInt(streamMilestones.endTime.toString()));

    let amountToWithdraw = depositedAmount;

    let withdrawIx = await program.methods
      .withdraw(amountToWithdraw)
      .accounts({
        recipient: recipient.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, recipient);

    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.amounts.withdrawn.eq(amountToWithdraw),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  // HELPER FUNCTIONS AND DATA STRUCTS

  async function buildSignAndProcessTxFromIx(ix: TxIx, signer: Keypair) {
    const tx = await initializeTxWithIx(ix);
    tx.sign(signer);
    await client.processTransaction(tx);
  }

  async function initializeTxWithIx(ix: TxIx): Promise<Transaction> {
    return (await initializeTx()).add(ix);
  }

  async function initializeTx(): Promise<Transaction> {
    const res = await client.getLatestBlockhash();
    if (!res) throw new Error("Couldn't get the latest blockhash");

    let tx = new Transaction();
    tx.recentBlockhash = res[0];
    return tx;
  }

  async function timeTravelForwardTo(timestamp: bigint) {
    const currentClock = await client.getClock();

    if (timestamp <= currentClock.unixTimestamp)
      throw new Error("Invalid timestamp: cannot time travel backwards");

    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        timestamp
      )
    );
  }

  async function createCancelableLockupLinearStream(): Promise<{
    stream: any;
    senderATA: PublicKey;
    recipientATA: PublicKey;
    tokenMint: PublicKey;
    depositedAmount: BN;
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

    await mintTo(
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

    const recipientATA = await createAssociatedTokenAccount(
      client,
      sender,
      tokenMint,
      recipient.publicKey
    );
    console.log(`Recipient's ATA: ${recipientATA}`);

    const streamMilestones = generateStandardStreamMilestones();

    const depositedAmount = new BN(6);
    const isCancelable = true;
    let createStreamIx = await program.methods
      .createLockupLinearStream(
        streamMilestones.startTime,
        streamMilestones.cliffTime,
        streamMilestones.endTime,
        depositedAmount,
        isCancelable
      )
      .accounts({
        sender: sender.publicKey,
        mint: tokenMint,
        recipient: recipient.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(createStreamIx, sender);

    return {
      stream: await fetchStream(senderATA, recipientATA),
      senderATA,
      recipientATA,
      tokenMint,
      depositedAmount,
      streamMilestones,
    };
  }

  async function fetchStream(
    senderATA: PublicKey,
    recipientATA: PublicKey
  ): Promise<any> {
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
    if (!streamAccount) {
      throw new Error("Stream account data is undefined");
    }

    // Return the Stream data decoded via the Anchor account layout
    const streamLayout = program.account.stream;

    return streamLayout.coder.accounts.decode(
      "stream",
      Buffer.from(streamAccount.data)
    );
  }

  async function generateAccWithSOL(
    context: ProgramTestContext
  ): Promise<Keypair> {
    const acc = Keypair.generate();
    const accInfo = getDefaultAccountInfoWithSOL();
    context.setAccount(acc.publicKey, accInfo);

    return acc;
  }
});
