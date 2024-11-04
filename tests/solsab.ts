import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
// import { getCustomErrorMessage } from "@solana-developers/helpers";
// import { systemProgramErrors } from "./system-errors";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  Account,
} from "@solana/spl-token";

import {
  confirmTransaction,
  createAccountsMintsAndTokenAccounts,
  makeKeypairs,
} from "@solana-developers/helpers";

import { Solsab } from "../target/types/solsab";

const web3 = anchor.web3;

describe("solsab", () => {
  // Use the cluster and the keypair from Anchor.toml
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;

  const sender = (provider.wallet as anchor.Wallet).payer;
  console.log(`Sender: ${sender.publicKey}`);
  const program = anchor.workspace.solsab as Program<Solsab>;
  const SOLSAB_PROGRAM_ID = program.programId;

  let treasuryPDA: anchor.web3.PublicKey;

  beforeEach(async () => {
    const balance = await connection.getBalance(sender.publicKey);
    const balanceInSOL = balance / web3.LAMPORTS_PER_SOL;
    const formattedBalance = new Intl.NumberFormat().format(balanceInSOL);
    console.log(`Balance: ${formattedBalance} SOL`);
  });

  async function createCancelableLockupLinearStream(): Promise<{
    stream: any;
    senderATA: Account;
    recipientATA: Account;
    tokenMint: anchor.web3.PublicKey;
    streamedAmount: anchor.BN;
  }> {
    const TOKEN_DECIMALS = 2;
    const freezeAuthority = null;
    const tokenMint = await createMint(
      connection,
      sender,
      sender.publicKey,
      freezeAuthority,
      TOKEN_DECIMALS
    );
    console.log(`Token Mint: ${tokenMint}`);

    const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, TOKEN_DECIMALS);

    const senderATA = await getOrCreateAssociatedTokenAccount(
      connection,
      sender,
      tokenMint,
      sender.publicKey
    );
    console.log(`Sender ATA: ${senderATA.address}`);

    const mintTxSig = await mintTo(
      connection,
      sender,
      tokenMint,
      senderATA.address,
      sender,
      10 * MINOR_UNITS_PER_MAJOR_UNITS
    );

    const recipient = anchor.web3.Keypair.generate();
    const recipientATA = await getOrCreateAssociatedTokenAccount(
      connection,
      sender,
      tokenMint,
      recipient.publicKey
    );
    console.log(`Recipient ATA: ${recipientATA.address}`);

    console.log(
      `Minted ${10 * MINOR_UNITS_PER_MAJOR_UNITS} tokens to the Sender ATA`
    );

    const streamedAmount = new anchor.BN(6);
    const isCancelable = true;

    let createStreamTxSig = await program.methods
      .createLockupLinearStream(streamedAmount, isCancelable)
      .accounts({
        mint: tokenMint,
        senderAta: senderATA.address,
        recipientAta: recipientATA.address,
      })
      .signers([sender])
      .rpc();

    await confirmTransaction(connection, createStreamTxSig, `confirmed`);

    // The seeds used when creating the Stream PDA
    const seeds = [
      Buffer.from("LL_stream"),
      Buffer.from(senderATA.address.toBytes()),
      Buffer.from(recipientATA.address.toBytes()),
    ];

    const [pdaAddress] = PublicKey.findProgramAddressSync(
      seeds,
      SOLSAB_PROGRAM_ID
    );

    // Assert that the Stream is no longer cancelable
    const stream = await program.account.stream.fetch(pdaAddress);

    return {
      stream,
      senderATA,
      recipientATA,
      tokenMint,
      streamedAmount: streamedAmount,
    };
  }

  it("initializes the SolSab program", async () => {
    // Pre-calculate the PDA address for the treasury
    [treasuryPDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    await program.methods
      .initialize()
      .accounts({
        signer: provider.wallet.publicKey,
      })
      .rpc();

    // Make sure the program is properly initialized
    // Confirm that the treasury PDA account was created and has expected properties
    const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
    assert.ok(treasuryAccount, "Treasury PDA not initialized");
  });

  it("Creates a LockupLinear Stream", async () => {
    const {
      stream,
      tokenMint,
      streamedAmount: streamedAmount,
    } = await createCancelableLockupLinearStream();

    // Derive the Treasury's ATA address
    const treasuryATA = getAssociatedTokenAddressSync(
      tokenMint,
      treasuryPDA,
      true
    );

    // Assert that the Treasury ATA contains the deposited tokens
    const treasuryBalanceResponse = await connection.getTokenAccountBalance(
      treasuryATA
    );
    const treasuryBalance = new anchor.BN(treasuryBalanceResponse.value.amount);
    assert(
      treasuryBalance.eq(streamedAmount),
      "Treasury hasn't received the sender's tokens"
    );
    console.log(`Treasury balance: ${treasuryBalance.toNumber()}`);

    assert(
      stream.isCancelable === true,
      "The created Stream is non-cancelable"
    );
  });

  it("Renounces the cancelability of a LockupLinear Stream", async () => {
    const { stream, senderATA, recipientATA } =
      await createCancelableLockupLinearStream();

    let renounceStreamTxSig = await program.methods
      .renounceStreamCancelability()
      .accounts({
        senderAta: senderATA.address,
        recipientAta: recipientATA.address,
      })
      .signers([sender])
      .rpc();

    await confirmTransaction(connection, renounceStreamTxSig, `confirmed`);

    assert(stream.isCancelable === true, "The Stream couldn't be renounced");
  });
});
