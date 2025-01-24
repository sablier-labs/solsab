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
  deriveATAAddress,
  getAssociatedTokenAddressSync,
  mintTo,
  getTokenBalanceByATAAccountData,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "./anchor-bankrun-adapter";

import {
  StreamMilestones,
  generateStandardStreamMilestones,
  getDefaultAccountInfoWithSOL,
} from "./utils";

//import * as helpers from "@solana-developers/helpers";

import { Lockup } from "../target/types/lockup";

describe("lockup", () => {
  let context: ProgramTestContext;
  let client: BanksClient;
  let senderKeys: Keypair;
  let recipientKeys: Keypair;
  let thirdPartyKeys: Keypair;
  let provider: BankrunProvider;
  let treasuryPDA: PublicKey;

  const program = anchor.workspace.lockup as anchor.Program<Lockup>;
  const LOCKUP_PROGRAM_ID = program.programId;

  beforeEach(async () => {
    // Configure the testing environment
    context = await startAnchor("", [], []);
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    client = context.banksClient;

    // Initialize the sender and recipient accounts
    senderKeys = provider.wallet.payer;
    recipientKeys = await generateAccWithSOL(context);
    thirdPartyKeys = await generateAccWithSOL(context);

    // Output the sender's public key
    console.log(`Sender: ${senderKeys.publicKey}`);

    // Output the sender's SOL balance
    const sendersBalance =
      (await client.getBalance(senderKeys.publicKey)) /
      BigInt(LAMPORTS_PER_SOL);
    console.log(`Sender's balance: ${sendersBalance.toString()} SOL`);

    // Output the recipient's public key
    console.log(`Recipient: ${recipientKeys.publicKey}`);

    // Output the recipient's SOL balance
    const recipientsBalance =
      (await client.getBalance(recipientKeys.publicKey)) /
      BigInt(LAMPORTS_PER_SOL);
    console.log(`Recipient's balance: ${recipientsBalance.toString()} SOL`);

    // Pre-calculate the PDA address for the treasury
    [treasuryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      LOCKUP_PROGRAM_ID
    );

    console.log("Treasury's PDA address: ", treasuryPDA.toBase58());

    let initializeIx = await program.methods
      .initialize()
      .accounts({
        signer: senderKeys.publicKey,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(initializeIx, senderKeys);

    // Make sure the program is properly initialized
    // Confirm that the treasury PDA account was created and has expected properties
    const treasuryAccount = await client.getAccount(treasuryPDA);
    assert.ok(treasuryAccount, "Treasury PDA not initialized");
  });

  it("Fails to create a LockupLinear Stream with a deposited amount > sender's balance", async () => {
    const { tokenMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = (await getTokenBalanceByATAKey(senderATA)).add(
      new BN(1)
    );

    // Attempt to create a Stream with a deposited amount greater than the sender's balance
    try {
      await createLockupLinearStream({
        senderKeys: senderKeys,
        recipient: recipientKeys.publicKey,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        streamMilestones: milestones,
        depositedAmount: depositedAmount,
        isCancelable: true,
      });
      assert.fail("The Stream creation should've failed, but it didn't.");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1"),
        "The Stream creation failed with an unexpected error"
      );
    }
  });

  it("Fails to create a LockupLinear Stream with a depositAmount = 0", async () => {
    const { tokenMint } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();

    // Attempt to create a Stream with a deposited amount of 0
    try {
      await createLockupLinearStream({
        senderKeys: senderKeys,
        recipient: recipientKeys.publicKey,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        streamMilestones: milestones,
        depositedAmount: new BN(0),
        isCancelable: true,
      });
      assert.fail("The Stream creation should've failed, but it didn't.");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1771"),
        "The Stream creation failed with an unexpected error"
      );
    }
  });

  it("Fails to create a LockupLinear Stream with an invalid token mint", async () => {
    const { senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Create an "invalid" mint (different from the one associated with the sender's and recipient's ATAs)
    const invalidTokenMint = await createMint(
      client,
      senderKeys,
      senderKeys.publicKey,
      null,
      2
    );

    // Attempt to create a Stream with an invalid token mint
    try {
      await createLockupLinearStream({
        senderKeys: senderKeys,
        recipient: recipientKeys.publicKey,
        tokenMint: invalidTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        streamMilestones: milestones,
        depositedAmount,
        isCancelable: true,
      });
      assert.fail("The Stream creation should've failed, but it didn't.");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0xbc4"),
        "The Stream creation failed with an unexpected error"
      );
    }
  });

  it("Fails to create a LockupLinear Stream when cliffTime < startTime", async () => {
    const { tokenMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with cliffTime < startTime
    milestones.cliffTime = milestones.startTime.sub(new BN(1));
    try {
      await createLockupLinearStream({
        senderKeys: senderKeys,
        recipient: recipientKeys.publicKey,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        streamMilestones: milestones,
        depositedAmount,
        isCancelable: true,
      });
      assert.fail("The Stream creation should've failed, but it didn't.");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1770"),
        "The Stream creation failed with an unexpected error"
      );
    }
  });

  it("Fails to create a LockupLinear Stream when cliffTime == startTime", async () => {
    const { tokenMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with cliffTime < startTime
    milestones.cliffTime = milestones.startTime;
    try {
      await createLockupLinearStream({
        senderKeys: senderKeys,
        recipient: recipientKeys.publicKey,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        streamMilestones: milestones,
        depositedAmount,
        isCancelable: true,
      });
      assert.fail("The Stream creation should've failed, but it didn't.");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1770"),
        "The Stream creation failed with an unexpected error"
      );
    }
  });

  it("Fails to create a LockupLinear Stream when cliffTime > endTime", async () => {
    const { tokenMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with cliffTime > endTime
    milestones.cliffTime = milestones.endTime.add(new BN(1));
    try {
      await createLockupLinearStream({
        senderKeys: senderKeys,
        recipient: recipientKeys.publicKey,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        streamMilestones: milestones,
        depositedAmount,
        isCancelable: true,
      });
      assert.fail("The Stream creation should've failed, but it didn't.");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1770"),
        "The Stream creation failed with an unexpected error"
      );
    }
  });

  it("Fails to create a LockupLinear Stream when cliffTime == endTime", async () => {
    const { tokenMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with cliffTime > endTime
    milestones.cliffTime = milestones.endTime;
    try {
      await createLockupLinearStream({
        senderKeys: senderKeys,
        recipient: recipientKeys.publicKey,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        streamMilestones: milestones,
        depositedAmount,
        isCancelable: true,
      });
      assert.fail("The Stream creation should've failed, but it didn't.");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1770"),
        "The Stream creation failed with an unexpected error"
      );
    }
  });

  it("Fails to create a LockupLinear Stream when endTime < startTime", async () => {
    const { tokenMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with endTime < startTime
    milestones.endTime = milestones.startTime.sub(new BN(1));
    try {
      await createLockupLinearStream({
        senderKeys: senderKeys,
        recipient: recipientKeys.publicKey,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        streamMilestones: milestones,
        depositedAmount,
        isCancelable: true,
      });
      assert.fail("The Stream creation should've failed, but it didn't.");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1770"),
        "The Stream creation failed with an unexpected error"
      );
    }
  });

  it("Fails to create a LockupLinear Stream when endTime < current time", async () => {
    const { tokenMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with endTime < current time
    milestones.endTime = new BN(0);
    try {
      await createLockupLinearStream({
        senderKeys: senderKeys,
        recipient: recipientKeys.publicKey,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        streamMilestones: milestones,
        depositedAmount,
        isCancelable: true,
      });
      assert.fail("The Stream creation should've failed, but it didn't.");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1772"),
        "The Stream creation failed with an unexpected error"
      );
    }
  });

  it("Creates a LockupLinear Stream", async () => {
    const { tokenMint, senderATA } = await createTokenAndMintToSender();

    // Get the initial token balances of the sender
    const [senderInitialTokenBalance] = await getTokenBalancesByATAKeys(
      senderATA
    );

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = senderInitialTokenBalance;
    await createLockupLinearStream({
      senderKeys: senderKeys,
      recipient: recipientKeys.publicKey,
      tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      streamMilestones: milestones,
      depositedAmount,
      isCancelable: true,
    });

    // Get the final token balances of the sender
    const [senderFinalTokenBalance] = await getTokenBalancesByATAKeys(
      senderATA
    );

    // Assert that the sender's token balance has changed as expected
    assert(
      senderFinalTokenBalance.eq(
        senderInitialTokenBalance.sub(depositedAmount)
      ),
      "The amount debited from the sender is incorrect"
    );

    // Derive the recipient's ATA address
    const recipientATA = await deriveRecipientATA(tokenMint);

    // Fetch the created Stream
    const stream = await fetchStream(senderATA, recipientATA);

    // Assert that the state of the created Stream is correct
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
    const treasuryBalance = await getTokenBalanceByATAKey(treasuryATA);

    assert(
      treasuryBalance.eq(depositedAmount),
      "Treasury hasn't received the sender's tokens"
    );
  });

  it("Creates a LockupLinear Stream with the Token2022 program", async () => {
    const { tokenMint, senderATA } = await createToken2022AndMintToSender();

    // Get the initial token balances of the sender
    const [senderInitialTokenBalance] = await getTokenBalancesByATAKeys(
      senderATA
    );

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = senderInitialTokenBalance;

    await createLockupLinearStream({
      senderKeys: senderKeys,
      recipient: recipientKeys.publicKey,
      tokenMint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      streamMilestones: milestones,
      depositedAmount,
      isCancelable: true,
    });

    // Get the final token balances of the sender
    const [senderFinalTokenBalance] = await getTokenBalancesByATAKeys(
      senderATA
    );

    // Assert that the sender's token balance has changed as expected
    assert(
      senderFinalTokenBalance.eq(
        senderInitialTokenBalance.sub(depositedAmount)
      ),
      "The amount debited from the sender is incorrect"
    );

    // Derive the recipient's ATA address
    const recipientATA = await deriveRecipientATAToken2022(tokenMint);

    // Fetch the created Stream
    const stream = await fetchStream(senderATA, recipientATA);

    // Assert that the state of the created Stream is correct
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
      true,
      TOKEN_2022_PROGRAM_ID
    );

    // Assert that the Treasury ATA contains the deposited tokens
    const treasuryBalance = await getTokenBalanceByATAKey(treasuryATA);

    assert(
      treasuryBalance.eq(depositedAmount),
      "Treasury hasn't received the sender's tokens"
    );
  });

  it("Fails to renounce cancelability when the Stream is not cancelable", async () => {
    const { senderATA, recipientATA } = await createMintATAsAndStream(false);

    let renounceStreamIx = await program.methods
      .renounce()
      .accounts({
        sender: senderKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
      })
      .instruction();

    try {
      // Build, sign and process the transaction
      await buildSignAndProcessTxFromIx(renounceStreamIx, senderKeys);
      assert.fail("The Stream cancelability renouncement should've failed");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1775"),
        "The Stream cancelability renouncement failed with an unexpected error"
      );
    }
  });

  it("Fails to renounce cancelability when tx signer != Stream sender", async () => {
    const { senderATA, recipientATA } = await createMintATAsAndStream(true);

    let renounceStreamIx = await program.methods
      .renounce()
      .accounts({
        sender: senderKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
      })
      .instruction();

    try {
      // Build, sign and process the transaction
      await buildSignAndProcessTxFromIx(renounceStreamIx, recipientKeys);
      assert.fail("The Stream cancelability renouncement should've failed");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("Signature verification failed"),
        "The Stream cancelability renouncement failed with an unexpected error"
      );
    }
  });

  it("Renounces the cancelability of a LockupLinear Stream", async () => {
    const { stream, senderATA, recipientATA } = await createMintATAsAndStream(
      true
    );

    let renounceStreamIx = await program.methods
      .renounce()
      .accounts({
        sender: senderKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(renounceStreamIx, senderKeys);

    assert(stream.isCancelable === true, "The Stream couldn't be renounced");
  });

  it("Fails to cancel a Stream that doesn't exist", async () => {
    const { senderATA, recipientATA, tokenMint } =
      await createMintATAsAndStream(true);

    let cancelStreamIx = await program.methods
      .cancel()
      .accounts({
        sender: recipientKeys.publicKey,
        senderAta: recipientATA,
        recipientAta: senderATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    try {
      // Build, sign and process the transaction
      await buildSignAndProcessTxFromIx(cancelStreamIx, recipientKeys);
      assert.fail("The Stream cancelation should've failed, but it didn't");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0xbc4"), // Error Code: AccountNotInitialized (i.e. stream)
        "The Stream cancelation failed with an unexpected error"
      );
    }
  });

  it("Fails to cancel a non-cancelable Stream", async () => {
    const { senderATA, recipientATA, tokenMint } =
      await createMintATAsAndStream(false);

    let cancelStreamIx = await program.methods
      .cancel()
      .accounts({
        sender: senderKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    try {
      // Build, sign and process the transaction
      await buildSignAndProcessTxFromIx(cancelStreamIx, senderKeys);
      assert.fail("The Stream cancelation should've failed, but it didn't");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1774"),
        "The Stream cancelation failed with an unexpected error"
      );
    }
  });

  it("Cancels a LockupLinear Stream immediately after creating it", async () => {
    const { senderATA, recipientATA, tokenMint, depositedAmount } =
      await createMintATAsAndStream(true);

    // Get the initial token balances of the sender and recipient
    const [senderInitialTokenBalance, recipientInitialTokenBalance] =
      await getTokenBalancesByATAKeys(senderATA, recipientATA);

    let cancelStreamIx = await program.methods
      .cancel()
      .accounts({
        sender: senderKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(cancelStreamIx, senderKeys);

    // Get the final token balances of the sender and recipient
    const [senderFinalTokenBalance, recipientFinalTokenBalance] =
      await getTokenBalancesByATAKeys(senderATA, recipientATA);

    // Assert that the sender's and recipient's token balances have been changed correctly
    const expectedRefundedAmount = depositedAmount;
    assert(
      senderFinalTokenBalance.eq(
        senderInitialTokenBalance.add(expectedRefundedAmount)
      ),
      "The amount refunded to the sender is incorrect"
    );

    const expectedWithdrawnAmount = new BN(0);
    assert(
      recipientFinalTokenBalance.eq(
        recipientInitialTokenBalance.add(expectedWithdrawnAmount)
      ),
      "No withdrawal to the recipient was expected"
    );

    // Assert that the Stream state has been updated correctly
    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.wasCanceled === true && stream.isCancelable === false,
      "The Stream couldn't be canceled"
    );

    assert(
      stream.amounts.refunded.eq(expectedRefundedAmount),
      "The Stream's refunded amount is incorrect"
    );

    assert(
      stream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Cancels a LockupLinear Stream at half time", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      depositedAmount,
      streamMilestones: milestones,
    } = await createMintATAsAndStream(true);

    // Get the initial token balances of the sender and recipient
    const [senderInitialTokenBalance, recipientInitialTokenBalance] =
      await getTokenBalancesByATAKeys(senderATA, recipientATA);

    const cancelTime = BigInt(
      milestones.startTime.add(milestones.endTime).div(new BN(2)).toString()
    );
    await cancelStreamAtSpecificTime(
      senderATA,
      recipientATA,
      tokenMint,
      cancelTime
    );

    // Get the final token balances of the sender and recipient
    const [senderFinalTokenBalance, recipientFinalTokenBalance] =
      await getTokenBalancesByATAKeys(senderATA, recipientATA);

    // Assert that the sender's and recipient's token balances have been changed correctly
    const expectedWithdrawnAmount = new BN(0);
    assert(
      recipientFinalTokenBalance.eq(
        recipientInitialTokenBalance.add(expectedWithdrawnAmount)
      ),
      "No withdrawal to the recipient was expected"
    );

    const expectedRefundedAmount = depositedAmount.div(new BN(2));
    assert(
      senderFinalTokenBalance.eq(
        senderInitialTokenBalance.add(expectedRefundedAmount)
      ),
      "The amount refunded to the sender is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.wasCanceled === true && stream.isCancelable === false,
      "The Stream couldn't be canceled"
    );

    assert(
      stream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );

    assert(
      stream.amounts.refunded.eq(expectedRefundedAmount),
      "The Stream's refunded amount is incorrect"
    );
  });

  it("Cancels a LockupLinear Stream after the tokens have been fully streamed", async () => {
    const { senderATA, recipientATA, tokenMint, streamMilestones } =
      await createMintATAsAndStream(true);

    // Get the initial token balances of the sender and recipient
    const [senderInitialTokenBalance, recipientInitialTokenBalance] =
      await getTokenBalancesByATAKeys(senderATA, recipientATA);

    const cancelTime = BigInt(streamMilestones.endTime.toString());

    await cancelStreamAtSpecificTime(
      senderATA,
      recipientATA,
      tokenMint,
      cancelTime
    );

    // Get the final token balances of the sender and recipient
    const [senderFinalTokenBalance, recipientFinalTokenBalance] =
      await getTokenBalancesByATAKeys(senderATA, recipientATA);

    // Assert that the sender's and recipient's token balances have been changed correctly
    const expectedRefundedAmount = new BN(0);
    assert(
      senderFinalTokenBalance.eq(
        senderInitialTokenBalance.add(expectedRefundedAmount)
      ),
      "The amount refunded to the sender is incorrect"
    );

    const expectedWithdrawnAmount = new BN(0);
    assert(
      recipientFinalTokenBalance.eq(
        recipientInitialTokenBalance.add(expectedWithdrawnAmount)
      ),
      "No withdrawal to the recipient was expected"
    );

    // Assert that the Stream state has been updated correctly
    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.wasCanceled === true && stream.isCancelable === false,
      "The Stream couldn't be canceled"
    );

    assert(
      stream.amounts.refunded.eq(expectedRefundedAmount),
      "The Stream's refunded amount is incorrect"
    );

    assert(
      stream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Fails to withdraw from a Stream as a non-recipient", async () => {
    const { senderATA, recipientATA, tokenMint } =
      await createMintATAsAndStream(true);

    let withdrawIx = await program.methods
      .withdrawMax()
      .accounts({
        signer: recipientKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    try {
      // Build, sign and process the transaction
      await buildSignAndProcessTxFromIx(withdrawIx, senderKeys);
      assert.fail("The Stream withdrawal should've failed, but it didn't");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("Signature verification failed"),
        "The Stream withdrawal failed with an unexpected error"
      );
    }
  });

  it("Fails to withdraw right before cliffTime", async () => {
    const { senderATA, recipientATA, tokenMint, streamMilestones } =
      await createMintATAsAndStream(true);

    await timeTravelForwardTo(
      BigInt(streamMilestones.cliffTime.sub(new BN(1)).toString())
    );

    let withdrawIx = await program.methods
      .withdrawMax()
      .accounts({
        signer: recipientKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    try {
      // Build, sign and process the transaction
      await buildSignAndProcessTxFromIx(withdrawIx, recipientKeys);
      assert.fail("The Stream withdrawal should've failed, but it didn't");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x1776"),
        "The Stream withdrawal failed with an unexpected error"
      );
    }
  });

  it("Withdraws max - as recipient - when half of the tokens have been streamed", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      streamMilestones,
      depositedAmount,
    } = await createMintATAsAndStream(true);

    // Get the initial token balances of the recipient
    const [recipientInitialTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    await timeTravelForwardTo(
      BigInt(
        streamMilestones.startTime
          .add(streamMilestones.endTime)
          .div(new BN(2))
          .toString()
      )
    );

    await withdrawMax(
      recipientKeys,
      recipientATA,
      senderATA,
      tokenMint,
      TOKEN_PROGRAM_ID
    );

    // Get the final token balances of the recipient
    const [recipientFinalTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    const expectedWithdrawnAmount = depositedAmount.div(new BN(2));
    assert(
      recipientFinalTokenBalance.eq(
        recipientInitialTokenBalance.add(expectedWithdrawnAmount)
      ),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Withdraws max - as recipient - after the Stream has been canceled at half time", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      depositedAmount,
      streamMilestones: milestones,
    } = await createMintATAsAndStream(true);

    // Get the initial token balances of the sender and recipient
    const [senderInitialTokenBalance, recipientInitialTokenBalance] =
      await getTokenBalancesByATAKeys(senderATA, recipientATA);

    const cancelTime = BigInt(
      milestones.startTime.add(milestones.endTime).div(new BN(2)).toString()
    );
    await cancelStreamAtSpecificTime(
      senderATA,
      recipientATA,
      tokenMint,
      cancelTime
    );

    await withdrawMax(
      recipientKeys,
      recipientATA,
      senderATA,
      tokenMint,
      TOKEN_PROGRAM_ID
    );

    // Get the final token balances of the sender and recipient
    const [senderFinalTokenBalance, recipientFinalTokenBalance] =
      await getTokenBalancesByATAKeys(senderATA, recipientATA);

    // Assert that the sender's and recipient's token balances have been changed correctly
    const expectedWithdrawnAmount = depositedAmount.div(new BN(2));
    assert(
      recipientFinalTokenBalance.eq(
        recipientInitialTokenBalance.add(expectedWithdrawnAmount)
      ),
      "No withdrawal to the recipient was expected"
    );

    const expectedRefundedAmount = expectedWithdrawnAmount;
    assert(
      senderFinalTokenBalance.eq(
        senderInitialTokenBalance.add(expectedRefundedAmount)
      ),
      "The amount refunded to the sender is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.wasCanceled === true && stream.isCancelable === false,
      "The Stream couldn't be canceled"
    );

    assert(
      stream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );

    assert(
      stream.amounts.refunded.eq(expectedRefundedAmount),
      "The Stream's refunded amount is incorrect"
    );
  });

  it("Withdraws - as recipient - a third of the streamed tokens at endTime", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      streamMilestones,
      depositedAmount,
    } = await createMintATAsAndStream(true);

    // Get the initial token balances of the recipient
    const [recipientInitialTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    await timeTravelForwardTo(BigInt(streamMilestones.endTime.toString()));

    const withdrawAmount = depositedAmount.div(new BN(3));
    let withdrawIx = await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        signer: recipientKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, recipientKeys);

    // Get the final token balances of the recipient
    const [recipientFinalTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    assert(
      recipientFinalTokenBalance.eq(
        recipientInitialTokenBalance.add(withdrawAmount)
      ),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.amounts.withdrawn.eq(withdrawAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Withdraws - as a third party & to the Stream's recipient ATA - a third of the streamed tokens at endTime", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      streamMilestones,
      depositedAmount,
    } = await createMintATAsAndStream(true);

    // Get the initial token balances of the recipient
    const [recipientInitialTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    await timeTravelForwardTo(BigInt(streamMilestones.endTime.toString()));

    const withdrawAmount = depositedAmount.div(new BN(3));
    let withdrawIx = await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        signer: thirdPartyKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, thirdPartyKeys);

    // Get the final token balances of the recipient
    const [recipientFinalTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    assert(
      recipientFinalTokenBalance.eq(
        recipientInitialTokenBalance.add(withdrawAmount)
      ),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.amounts.withdrawn.eq(withdrawAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Withdraws max - as recipient - at endTime", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      streamMilestones,
      depositedAmount,
    } = await createMintATAsAndStream(true);

    // Get the initial token balances of the recipient
    const [recipientInitialTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    await timeTravelForwardTo(BigInt(streamMilestones.endTime.toString()));

    let withdrawIx = await program.methods
      .withdrawMax()
      .accounts({
        signer: recipientKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, recipientKeys);

    // Get the final token balances of the recipient
    const [recipientFinalTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    const expectedWithdrawnAmount = depositedAmount;
    assert(
      recipientFinalTokenBalance.eq(
        recipientInitialTokenBalance.add(expectedWithdrawnAmount)
      ),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Withdraws max - as a third party & to the Stream's recipient ATA - at endTime", async () => {
    const {
      senderATA,
      recipientATA,
      tokenMint,
      streamMilestones,
      depositedAmount,
    } = await createMintATAsAndStream(true);

    // Get the initial token balances of the recipient
    const [recipientInitialTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    await timeTravelForwardTo(BigInt(streamMilestones.endTime.toString()));

    let withdrawIx = await program.methods
      .withdrawMax()
      .accounts({
        signer: thirdPartyKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, thirdPartyKeys);

    // Get the final token balances of the recipient
    const [recipientFinalTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    const expectedWithdrawnAmount = depositedAmount;
    assert(
      recipientFinalTokenBalance.eq(
        recipientInitialTokenBalance.add(expectedWithdrawnAmount)
      ),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const stream = await fetchStream(senderATA, recipientATA);

    assert(
      stream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  // HELPER FUNCTIONS AND DATA STRUCTS

  async function buildSignAndProcessTxFromIx(ix: TxIx, signerKeys: Keypair) {
    const tx = await initializeTxWithIx(ix);
    tx.sign(signerKeys);
    const banksTxMeta = await client.processTransaction(tx);

    console.log(
      "Compute Units consumed by the Tx: {}",
      banksTxMeta.computeUnitsConsumed.toString()
    );
  }

  async function cancelStreamAtSpecificTime(
    senderATA: PublicKey,
    recipientATA: PublicKey,
    tokenMint: PublicKey,
    timestamp: bigint
  ): Promise<void> {
    await timeTravelForwardTo(timestamp);

    let cancelStreamIx = await program.methods
      .cancel()
      .accounts({
        sender: senderKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(cancelStreamIx, senderKeys);
  }

  async function createMintATAsAndStream(isStreamCancelable: boolean): Promise<{
    stream: any;
    senderATA: PublicKey;
    recipientATA: PublicKey;
    tokenMint: PublicKey;
    depositedAmount: BN;
    streamMilestones: StreamMilestones;
  }> {
    const { tokenMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);
    await createLockupLinearStream({
      senderKeys: senderKeys,
      recipient: recipientKeys.publicKey,
      tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      streamMilestones: milestones,
      depositedAmount,
      isCancelable: isStreamCancelable,
    });

    // Derive the recipient's ATA address
    const recipientATA = await deriveRecipientATA(tokenMint);

    return {
      stream: await fetchStream(senderATA, recipientATA),
      senderATA,
      recipientATA,
      tokenMint,
      depositedAmount,
      streamMilestones: milestones,
    };
  }

  async function createTokenAndMintToSender(): Promise<{
    tokenMint: PublicKey;
    senderATA: PublicKey;
  }> {
    const TOKEN_DECIMALS = 2;
    const freezeAuthority = null;

    const tokenMint = await createMint(
      client,
      senderKeys,
      senderKeys.publicKey,
      freezeAuthority,
      TOKEN_DECIMALS
    );

    const senderATA = await createAssociatedTokenAccount(
      client,
      senderKeys,
      tokenMint,
      senderKeys.publicKey,
      TOKEN_PROGRAM_ID
    );
    console.log(`Sender's ATA: ${senderATA}`);

    const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, TOKEN_DECIMALS);
    await mintTo(
      client,
      senderKeys,
      tokenMint,
      senderATA,
      senderKeys,
      10 * MINOR_UNITS_PER_MAJOR_UNITS
    );

    console.log(
      `Minted ${10 * MINOR_UNITS_PER_MAJOR_UNITS} tokens to the Sender ATA`
    );

    return { tokenMint, senderATA };
  }

  async function withdrawMax(
    txSigner: Keypair,
    recipientATA: PublicKey,
    senderATA: PublicKey,
    tokenMint: PublicKey,
    tokenProgram: PublicKey
  ) {
    let withdrawIx = await program.methods
      .withdrawMax()
      .accounts({
        signer: txSigner.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: tokenMint,
        tokenProgram,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, txSigner);
  }

  interface CreateLockupLinearStreamArgs {
    senderKeys: Keypair;
    recipient: PublicKey;
    tokenMint: PublicKey;
    tokenProgram: PublicKey;
    streamMilestones: StreamMilestones;
    depositedAmount: BN;
    isCancelable: boolean;
  }

  async function createToken2022AndMintToSender(): Promise<{
    tokenMint: PublicKey;
    senderATA: PublicKey;
  }> {
    const TOKEN_DECIMALS = 9;
    const freezeAuthority = null;
    const tokenMint = await createMint(
      client,
      senderKeys,
      senderKeys.publicKey,
      freezeAuthority,
      TOKEN_DECIMALS,
      Keypair.generate(),
      TOKEN_2022_PROGRAM_ID
    );

    console.log(`Created Token Mint: ${tokenMint}`);

    const senderATA = await createAssociatedTokenAccount(
      client,
      senderKeys,
      tokenMint,
      senderKeys.publicKey,
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`Sender's ATA: ${senderATA}`);

    const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, TOKEN_DECIMALS);
    const signers: anchor.web3.Signer[] = [];
    await mintTo(
      client,
      senderKeys,
      tokenMint,
      senderATA,
      senderKeys,
      10 * MINOR_UNITS_PER_MAJOR_UNITS,
      signers,
      TOKEN_2022_PROGRAM_ID
    );

    console.log(
      `Minted ${10 * MINOR_UNITS_PER_MAJOR_UNITS} tokens to the Sender ATA`
    );

    return { tokenMint, senderATA };
  }

  async function createLockupLinearStream(
    args: CreateLockupLinearStreamArgs
  ): Promise<void> {
    const {
      senderKeys,
      recipient,
      tokenMint,
      tokenProgram,
      streamMilestones,
      depositedAmount,
      isCancelable,
    } = args;

    let createStreamIx = await program.methods
      .createWithTimestamps(
        streamMilestones.startTime,
        streamMilestones.cliffTime,
        streamMilestones.endTime,
        depositedAmount,
        isCancelable
      )
      .accounts({
        sender: senderKeys.publicKey,
        mint: tokenMint,
        recipient,
        tokenProgram,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(createStreamIx, senderKeys);
  }

  async function deriveRecipientATA(tokenMint: PublicKey): Promise<PublicKey> {
    return deriveATAAddress(
      tokenMint,
      recipientKeys.publicKey,
      TOKEN_PROGRAM_ID
    );
  }

  async function deriveRecipientATAToken2022(
    tokenMint: PublicKey
  ): Promise<PublicKey> {
    return deriveATAAddress(
      tokenMint,
      recipientKeys.publicKey,
      TOKEN_2022_PROGRAM_ID
    );
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
      LOCKUP_PROGRAM_ID
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

  async function getTokenBalancesByATAKeys(
    ...atas: PublicKey[]
  ): Promise<BN[]> {
    const balances = await Promise.all(
      atas.map(async (ata) => {
        const balance = await getTokenBalanceByATAKey(ata);
        return balance;
      })
    );
    return balances;
  }

  async function getTokenBalanceByATAKey(ata: PublicKey): Promise<BN> {
    const ataData = (await client.getAccount(ata))?.data;
    assert.ok(ataData, "ATA data is undefined");

    return new BN(getTokenBalanceByATAAccountData(ataData));
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
});
