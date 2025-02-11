import {
  ComputeBudgetProgram,
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

import { SablierLockup } from "../target/types/sablier_lockup";

describe("SablierLockup", () => {
  let context: ProgramTestContext;
  let client: BanksClient;
  let senderKeys: Keypair;
  let recipientKeys: Keypair;
  let thirdPartyKeys: Keypair;
  let provider: BankrunProvider;
  let treasuryAddress: PublicKey;
  let nftCollectionDataAddress: PublicKey;
  let nftCollectionMint: PublicKey;
  let nftCollectionTokenAccount: PublicKey;
  let nftCollectionMetadata: PublicKey;
  let nftCollectionMasterEdition: PublicKey;
  let program: anchor.Program<SablierLockup>;
  let lockup_program_id: PublicKey;

  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  beforeEach(async () => {
    // Configure the testing environment
    context = await startAnchor(
      "",
      [
        {
          name: "token_metadata_program",
          programId: TOKEN_METADATA_PROGRAM_ID,
        },
      ],
      []
    );
    client = context.banksClient;

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    // DEV: The program must be fetched after the provider has been set, so that the data from inside a program's PDA can be accessed/used as a seed for another PDA (e.g. `stream_nft_mint` being derived from `nft_collection_data.nfts_total_supply`)
    program = anchor.workspace.sablier_lockup as anchor.Program<SablierLockup>;
    lockup_program_id = program.programId;

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

    // Output the recipient's public key
    console.log(`Recipient: ${recipientKeys.publicKey}`);

    // Output the third party's SOL balance
    const thirdPartyBalance =
      (await client.getBalance(thirdPartyKeys.publicKey)) /
      BigInt(LAMPORTS_PER_SOL);
    console.log(`Third party's balance: ${thirdPartyBalance.toString()} SOL`);

    // Pre-calculate the PDA address for the treasury
    treasuryAddress = getPDAAddress(
      [Buffer.from("treasury")],
      lockup_program_id
    );

    console.log("Treasury's address: ", treasuryAddress.toBase58());

    // Pre-calculate the PDA address for the NFT Collection Data
    nftCollectionDataAddress = getPDAAddress(
      [Buffer.from("nft_collection_data")],
      lockup_program_id
    );

    console.log(
      "NFT Collection Data's address: ",
      nftCollectionDataAddress.toBase58()
    );

    let initializePhaseOneIx = await program.methods
      .initializePhaseOne()
      .accounts({
        signer: senderKeys.publicKey,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(initializePhaseOneIx, senderKeys);

    // Confirm that the treasury PDA account has been initialized
    assert.ok(
      await client.getAccount(treasuryAddress),
      "Treasury PDA not initialized"
    );

    // Confirm that the NFT Collection Data PDA account has been initialized
    assert.ok(
      await client.getAccount(nftCollectionDataAddress),
      "NFT Collection Data PDA not initialized"
    );

    let initializePhaseTwoIx = await program.methods
      .initializePhaseTwo()
      .accounts({
        signer: senderKeys.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(initializePhaseTwoIx, senderKeys);

    nftCollectionMint = getPDAAddress(
      [Buffer.from("nft_collection_mint")],
      lockup_program_id
    );

    console.log(
      "NFT Collection Mint's address: ",
      nftCollectionMint.toBase58()
    );

    const nftCollectionMintToBuffer = nftCollectionMint.toBuffer();

    nftCollectionTokenAccount = getPDAAddress(
      [Buffer.from("collection_token_account"), nftCollectionMintToBuffer],
      lockup_program_id
    );

    // Confirm that the NFT Collection Mint account has been initialized
    assert.ok(
      await client.getAccount(nftCollectionMint),
      "NFT Collection Mint not initialized"
    );

    // TODO: figure our the exact derivation of the NFT Collection Token Account, in order to properly test its initialization

    // // Confirm that the NFT Collection Token Account has been initialized
    // assert.ok(
    //   await client.getAccount(nftCollectionTokenAccount),
    //   "NFT Collection Token Account not initialized"
    // );

    nftCollectionMetadata = getPDAAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        nftCollectionMintToBuffer,
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    console.log(
      "NFT Collection Metadata's address: ",
      nftCollectionMetadata.toBase58()
    );

    // Confirm that the NFT Collection Metadata account has been initialized
    assert.ok(
      await client.getAccount(nftCollectionMetadata),
      "NFT Collection Metadata not initialized"
    );

    nftCollectionMasterEdition = getPDAAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        nftCollectionMintToBuffer,
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    console.log(
      "NFT Collection Master Edition's address: ",
      nftCollectionMasterEdition.toBase58()
    );

    // Confirm that the NFT Collection Master Edition account has been initialized
    assert.ok(
      await client.getAccount(nftCollectionMasterEdition),
      "NFT Collection Master Edition not initialized"
    );
  });

  it("Fails to create a LockupLinear Stream with a deposited amount > sender's balance", async () => {
    const { assetMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = (await getTokenBalanceByATAKey(senderATA)).add(
      new BN(1)
    );

    // Attempt to create a Stream with a deposited amount greater than the sender's balance
    try {
      await createLLStreamWithTimestamps({
        senderKeys,
        recipient: recipientKeys.publicKey,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        milestones,
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
    const { assetMint } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();

    // Attempt to create a Stream with a deposited amount of 0
    try {
      await createLLStreamWithTimestamps({
        senderKeys,
        recipient: recipientKeys.publicKey,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        milestones,
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
      await createLLStreamWithTimestamps({
        senderKeys,
        recipient: recipientKeys.publicKey,
        assetMint: invalidTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        milestones,
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
    const { assetMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with cliffTime < startTime
    milestones.cliffTime = milestones.startTime.sub(new BN(1));
    try {
      await createLLStreamWithTimestamps({
        senderKeys,
        recipient: recipientKeys.publicKey,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        milestones,
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
    const { assetMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with cliffTime < startTime
    milestones.cliffTime = milestones.startTime;
    try {
      await createLLStreamWithTimestamps({
        senderKeys,
        recipient: recipientKeys.publicKey,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        milestones,
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
    const { assetMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with cliffTime > endTime
    milestones.cliffTime = milestones.endTime.add(new BN(1));
    try {
      await createLLStreamWithTimestamps({
        senderKeys,
        recipient: recipientKeys.publicKey,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        milestones,
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
    const { assetMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with cliffTime > endTime
    milestones.cliffTime = milestones.endTime;
    try {
      await createLLStreamWithTimestamps({
        senderKeys,
        recipient: recipientKeys.publicKey,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        milestones,
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
    const { assetMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with endTime < startTime
    milestones.endTime = milestones.startTime.sub(new BN(1));
    try {
      await createLLStreamWithTimestamps({
        senderKeys,
        recipient: recipientKeys.publicKey,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        milestones,
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
    const { assetMint, senderATA } = await createTokenAndMintToSender();

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);

    // Attempt to create a Stream with endTime < current time
    milestones.endTime = new BN(0);
    try {
      await createLLStreamWithTimestamps({
        senderKeys,
        recipient: recipientKeys.publicKey,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        milestones,
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
    const { assetMint, senderATA } = await createTokenAndMintToSender();

    const streamId = await deduceCurrentStreamId();
    console.log("Deduced Stream ID: ", streamId.toString());

    // Get the initial token balances of the sender
    const [senderInitialTokenBalance] = await getTokenBalancesByATAKeys(
      senderATA
    );

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = senderInitialTokenBalance;
    await createLLStreamWithTimestamps({
      senderKeys,
      recipient: recipientKeys.publicKey,
      assetMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      milestones,
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

    // Fetch the created Stream
    const streamData = await fetchStream(streamId);

    // Assert that the state of the created Stream is correct
    assert(
      streamData.id.eq(streamId) &&
        streamData.sender.equals(senderKeys.publicKey) &&
        streamData.recipient.equals(recipientKeys.publicKey) &&
        streamData.assetMint.equals(assetMint) &&
        streamData.isCancelable === true &&
        streamData.wasCanceled === false,
      "The state of the created Stream is wrong"
    );

    assert(
      streamData.amounts.deposited.eq(depositedAmount) &&
        streamData.amounts.withdrawn.eq(new BN(0)) &&
        streamData.amounts.refunded.eq(new BN(0)),
      "The created Stream's amounts are incorrect"
    );

    assert(
      streamData.milestones.startTime.eq(milestones.startTime) &&
        streamData.milestones.cliffTime.eq(milestones.cliffTime) &&
        streamData.milestones.endTime.eq(milestones.endTime),
      "The created Stream's milestones are incorrect"
    );

    // Derive the Treasury's ATA address
    const treasuryATA = getAssociatedTokenAddressSync(
      assetMint,
      treasuryAddress,
      true
    );

    // Assert that the Treasury ATA contains the deposited tokens
    const treasuryBalance = await getTokenBalanceByATAKey(treasuryATA);

    assert(
      treasuryBalance.eq(depositedAmount),
      "Treasury hasn't received the sender's tokens"
    );
  });

  it.skip("Creates a LockupLinear Stream with the Token2022 program", async () => {
    const { assetMint, senderATA } = await createToken2022AndMintToSender();

    const streamId = await deduceCurrentStreamId();

    // Get the initial token balances of the sender
    const [senderInitialTokenBalance] = await getTokenBalancesByATAKeys(
      senderATA
    );

    const milestones = generateStandardStreamMilestones();
    const depositedAmount = senderInitialTokenBalance;

    await createLLStreamWithTimestamps({
      senderKeys,
      recipient: recipientKeys.publicKey,
      assetMint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      milestones,
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
    const recipientATA = await deriveRecipientATAToken2022(assetMint);

    // Fetch the created Stream
    const streamData = await fetchStream(streamId);

    // Assert that the state of the created Stream is correct
    assert(
      streamData.senderAta.equals(senderATA) &&
        streamData.recipientAta.equals(recipientATA) &&
        streamData.assetMintAccount.equals(assetMint) &&
        streamData.isCancelable === true &&
        streamData.wasCanceled === false,
      "The state of the created Stream is wrong"
    );

    assert(
      streamData.amounts.deposited.eq(depositedAmount) &&
        streamData.amounts.withdrawn.eq(new BN(0)) &&
        streamData.amounts.refunded.eq(new BN(0)),
      "The created Stream's amounts are incorrect"
    );

    assert(
      streamData.milestones.startTime.eq(milestones.startTime) &&
        streamData.milestones.cliffTime.eq(milestones.cliffTime) &&
        streamData.milestones.endTime.eq(milestones.endTime),
      "The created Stream's milestones are incorrect"
    );

    // Derive the Treasury's ATA address
    const treasuryATA = getAssociatedTokenAddressSync(
      assetMint,
      treasuryAddress,
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
    const { streamData } = await createMintATAsAndStream(false);

    let renounceStreamIx = await program.methods
      .renounce(streamData.id)
      .accounts({
        sender: senderKeys.publicKey,
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
    const { streamData } = await createMintATAsAndStream(true);

    let renounceStreamIx = await program.methods
      .renounce(streamData.id)
      .accounts({
        sender: senderKeys.publicKey,
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
    const { streamData } = await createMintATAsAndStream(true);

    let renounceStreamIx = await program.methods
      .renounce(streamData.id)
      .accounts({
        sender: senderKeys.publicKey,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(renounceStreamIx, senderKeys);

    assert(
      streamData.isCancelable === true,
      "The Stream couldn't be renounced"
    );
  });

  // it("Fails to cancel a Stream that doesn't exist", async () => {
  //   const { senderATA, recipientATA, assetMint } =
  //     await createMintATAsAndStream(true);

  //   let cancelStreamIx = await program.methods
  //     .cancel()
  //     .accounts({
  //       sender: recipientKeys.publicKey,
  //       senderAta: recipientATA,
  //       recipientAta: senderATA,
  //       mint: assetMint,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     })
  //     .instruction();

  //   try {
  //     // Build, sign and process the transaction
  //     await buildSignAndProcessTxFromIx(cancelStreamIx, recipientKeys);
  //     assert.fail("The Stream cancelation should've failed, but it didn't");
  //   } catch (error) {
  //     assert(
  //       // TODO: Figure out a more robust way of checking the thrown error
  //       (error as Error).message.includes("custom program error: 0xbc4"), // Error Code: AccountNotInitialized (i.e. streamData)
  //       "The Stream cancelation failed with an unexpected error"
  //     );
  //   }
  // });

  // it("Fails to cancel a non-cancelable Stream", async () => {
  //   const { senderATA, recipientATA, assetMint } =
  //     await createMintATAsAndStream(false);

  //   let cancelStreamIx = await program.methods
  //     .cancel()
  //     .accounts({
  //       sender: senderKeys.publicKey,
  //       senderAta: senderATA,
  //       recipientAta: recipientATA,
  //       mint: assetMint,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     })
  //     .instruction();

  //   try {
  //     // Build, sign and process the transaction
  //     await buildSignAndProcessTxFromIx(cancelStreamIx, senderKeys);
  //     assert.fail("The Stream cancelation should've failed, but it didn't");
  //   } catch (error) {
  //     assert(
  //       // TODO: Figure out a more robust way of checking the thrown error
  //       (error as Error).message.includes("custom program error: 0x1774"),
  //       "The Stream cancelation failed with an unexpected error"
  //     );
  //   }
  // });

  // it("Cancels a LockupLinear Stream immediately after creating it", async () => {
  //   const { senderATA, recipientATA, assetMint, depositedAmount } =
  //     await createMintATAsAndStream(true);

  //   // Get the initial token balances of the sender and recipient
  //   const [senderInitialTokenBalance, recipientInitialTokenBalance] =
  //     await getTokenBalancesByATAKeys(senderATA, recipientATA);

  //   let cancelStreamIx = await program.methods
  //     .cancel()
  //     .accounts({
  //       sender: senderKeys.publicKey,
  //       senderAta: senderATA,
  //       recipientAta: recipientATA,
  //       mint: assetMint,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     })
  //     .instruction();

  //   // Build, sign and process the transaction
  //   await buildSignAndProcessTxFromIx(cancelStreamIx, senderKeys);

  //   // Get the final token balances of the sender and recipient
  //   const [senderFinalTokenBalance, recipientFinalTokenBalance] =
  //     await getTokenBalancesByATAKeys(senderATA, recipientATA);

  //   // Assert that the sender's and recipient's token balances have been changed correctly
  //   const expectedRefundedAmount = depositedAmount;
  //   assert(
  //     senderFinalTokenBalance.eq(
  //       senderInitialTokenBalance.add(expectedRefundedAmount)
  //     ),
  //     "The amount refunded to the sender is incorrect"
  //   );

  //   const expectedWithdrawnAmount = new BN(0);
  //   assert(
  //     recipientFinalTokenBalance.eq(
  //       recipientInitialTokenBalance.add(expectedWithdrawnAmount)
  //     ),
  //     "No withdrawal to the recipient was expected"
  //   );

  //   // Assert that the Stream state has been updated correctly
  //   const streamData = await fetchStream(senderATA, recipientATA);

  //   assert(
  //     streamData.wasCanceled === true && streamData.isCancelable === false,
  //     "The Stream couldn't be canceled"
  //   );

  //   assert(
  //     streamData.amounts.refunded.eq(expectedRefundedAmount),
  //     "The Stream's refunded amount is incorrect"
  //   );

  //   assert(
  //     streamData.amounts.withdrawn.eq(expectedWithdrawnAmount),
  //     "The Stream's withdrawn amount is incorrect"
  //   );
  // });

  // it("Cancels a LockupLinear Stream at half time", async () => {
  //   const {
  //     senderATA,
  //     recipientATA,
  //     assetMint,
  //     depositedAmount,
  //     milestones,
  //   } = await createMintATAsAndStream(true);

  //   // Get the initial token balances of the sender and recipient
  //   const [senderInitialTokenBalance, recipientInitialTokenBalance] =
  //     await getTokenBalancesByATAKeys(senderATA, recipientATA);

  //   const cancelTime = BigInt(
  //     milestones.startTime.add(milestones.endTime).div(new BN(2)).toString()
  //   );
  //   await cancelStreamAtSpecificTime(
  //     senderATA,
  //     recipientATA,
  //     assetMint,
  //     cancelTime
  //   );

  //   // Get the final token balances of the sender and recipient
  //   const [senderFinalTokenBalance, recipientFinalTokenBalance] =
  //     await getTokenBalancesByATAKeys(senderATA, recipientATA);

  //   // Assert that the sender's and recipient's token balances have been changed correctly
  //   const expectedWithdrawnAmount = new BN(0);
  //   assert(
  //     recipientFinalTokenBalance.eq(
  //       recipientInitialTokenBalance.add(expectedWithdrawnAmount)
  //     ),
  //     "No withdrawal to the recipient was expected"
  //   );

  //   const expectedRefundedAmount = depositedAmount.div(new BN(2));
  //   assert(
  //     senderFinalTokenBalance.eq(
  //       senderInitialTokenBalance.add(expectedRefundedAmount)
  //     ),
  //     "The amount refunded to the sender is incorrect"
  //   );

  //   // Assert that the Stream state has been updated correctly
  //   const streamData = await fetchStream(senderATA, recipientATA);

  //   assert(
  //     streamData.wasCanceled === true && streamData.isCancelable === false,
  //     "The Stream couldn't be canceled"
  //   );

  //   assert(
  //     streamData.amounts.withdrawn.eq(expectedWithdrawnAmount),
  //     "The Stream's withdrawn amount is incorrect"
  //   );

  //   assert(
  //     streamData.amounts.refunded.eq(expectedRefundedAmount),
  //     "The Stream's refunded amount is incorrect"
  //   );
  // });

  // it("Cancels a LockupLinear Stream after the tokens have been fully streamed", async () => {
  //   const { senderATA, recipientATA, assetMint, milestones } =
  //     await createMintATAsAndStream(true);

  //   // Get the initial token balances of the sender and recipient
  //   const [senderInitialTokenBalance, recipientInitialTokenBalance] =
  //     await getTokenBalancesByATAKeys(senderATA, recipientATA);

  //   const cancelTime = BigInt(milestones.endTime.toString());

  //   await cancelStreamAtSpecificTime(
  //     senderATA,
  //     recipientATA,
  //     assetMint,
  //     cancelTime
  //   );

  //   // Get the final token balances of the sender and recipient
  //   const [senderFinalTokenBalance, recipientFinalTokenBalance] =
  //     await getTokenBalancesByATAKeys(senderATA, recipientATA);

  //   // Assert that the sender's and recipient's token balances have been changed correctly
  //   const expectedRefundedAmount = new BN(0);
  //   assert(
  //     senderFinalTokenBalance.eq(
  //       senderInitialTokenBalance.add(expectedRefundedAmount)
  //     ),
  //     "The amount refunded to the sender is incorrect"
  //   );

  //   const expectedWithdrawnAmount = new BN(0);
  //   assert(
  //     recipientFinalTokenBalance.eq(
  //       recipientInitialTokenBalance.add(expectedWithdrawnAmount)
  //     ),
  //     "No withdrawal to the recipient was expected"
  //   );

  //   // Assert that the Stream state has been updated correctly
  //   const streamData = await fetchStream(senderATA, recipientATA);

  //   assert(
  //     streamData.wasCanceled === true && streamData.isCancelable === false,
  //     "The Stream couldn't be canceled"
  //   );

  //   assert(
  //     streamData.amounts.refunded.eq(expectedRefundedAmount),
  //     "The Stream's refunded amount is incorrect"
  //   );

  //   assert(
  //     streamData.amounts.withdrawn.eq(expectedWithdrawnAmount),
  //     "The Stream's withdrawn amount is incorrect"
  //   );
  // });

  it("Fails to withdraw from a Stream as a non-recipient", async () => {
    const { streamData, recipient, assetMint } = await createMintATAsAndStream(
      true
    );

    let withdrawIx = await program.methods
      .withdrawMax(streamData.id)
      .accounts({
        signer: recipientKeys.publicKey,
        assetMint,
        recipient,
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
    const { streamData, recipient, assetMint, milestones } =
      await createMintATAsAndStream(true);

    await timeTravelForwardTo(
      BigInt(milestones.cliffTime.sub(new BN(1)).toString())
    );

    let withdrawIx = await program.methods
      .withdrawMax(streamData.id)
      .accounts({
        signer: recipientKeys.publicKey,
        assetMint,
        recipient,
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
    const { streamData, recipient, assetMint, milestones, depositedAmount } =
      await createMintATAsAndStream(true);

    await timeTravelForwardTo(
      BigInt(
        milestones.startTime.add(milestones.endTime).div(new BN(2)).toString()
      )
    );

    await withdrawMax(
      streamData.id,
      recipientKeys,
      recipient,
      assetMint,
      TOKEN_PROGRAM_ID
    );

    // Derive the recipient's ATA address
    const recipientATA = await deriveRecipientATA(assetMint);

    // Get the recipient's token balance
    const [recipientTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    const expectedWithdrawnAmount = depositedAmount.div(new BN(2));
    assert(
      recipientTokenBalance.eq(expectedWithdrawnAmount),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const fetchedStream = await fetchStream(streamData.id);

    assert(
      fetchedStream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  // it("Withdraws max - as recipient - after the Stream has been canceled at half time", async () => {
  //   const {
  //     streamData,
  //     recipient,
  //     senderATA,
  //     assetMint,
  //     depositedAmount,
  //     milestones,
  //   } = await createMintATAsAndStream(true);

  //   // Get the initial token balances of the sender and recipient
  //   const senderInitialTokenBalance = await getTokenBalancesByATAKeys(
  //     senderATA
  //   );

  //   const cancelTime = BigInt(
  //     milestones.startTime.add(milestones.endTime).div(new BN(2)).toString()
  //   );
  //   await cancelStreamAtSpecificTime(
  //     senderATA,
  //     //recipientATA,
  //     assetMint,
  //     cancelTime
  //   );

  //   await withdrawMax(
  //     streamData.id,
  //     recipientKeys,
  //     recipient,
  //     assetMint,
  //     TOKEN_PROGRAM_ID
  //   );

  //   // Derive the recipient's ATA address
  //   const recipientATA = await deriveRecipientATA(assetMint);

  //   // Get the final token balances of the sender and recipient
  //   const [senderFinalTokenBalance, recipientFinalTokenBalance] =
  //     await getTokenBalancesByATAKeys(senderATA, recipientATA);

  //   // Assert that the sender's and recipient's token balances have been changed correctly
  //   const expectedWithdrawnAmount = depositedAmount.div(new BN(2));
  //   assert(
  //     recipientFinalTokenBalance.eq(
  //       recipientInitialTokenBalance.add(expectedWithdrawnAmount)
  //     ),
  //     "No withdrawal to the recipient was expected"
  //   );

  //   const expectedRefundedAmount = expectedWithdrawnAmount;
  //   assert(
  //     senderFinalTokenBalance.eq(
  //       senderInitialTokenBalance.add(expectedRefundedAmount)
  //     ),
  //     "The amount refunded to the sender is incorrect"
  //   );

  //   // Assert that the Stream state has been updated correctly
  //   const fetchedStreamData = await fetchStream(streamData.id);

  //   assert(
  //     fetchedStreamData.wasCanceled === true &&
  //       fetchedStreamData.isCancelable === false,
  //     "The Stream couldn't be canceled"
  //   );

  //   assert(
  //     fetchedStreamData.amounts.withdrawn.eq(expectedWithdrawnAmount),
  //     "The Stream's withdrawn amount is incorrect"
  //   );

  //   assert(
  //     fetchedStreamData.amounts.refunded.eq(expectedRefundedAmount),
  //     "The Stream's refunded amount is incorrect"
  //   );
  // });

  it("Withdraws - as recipient - a third of the streamed tokens at endTime", async () => {
    const { streamData, recipient, assetMint, milestones, depositedAmount } =
      await createMintATAsAndStream(true);

    await timeTravelForwardTo(BigInt(milestones.endTime.toString()));

    const withdrawAmount = depositedAmount.div(new BN(3));
    let withdrawIx = await program.methods
      .withdraw(streamData.id, withdrawAmount)
      .accounts({
        signer: recipientKeys.publicKey,
        assetMint,
        recipient,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, recipientKeys);

    // Derive the recipient's newly created ATA address
    const recipientATA = await deriveRecipientATA(assetMint);

    // Get the token balance of the recipient
    const [recipientTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    assert(
      recipientTokenBalance.eq(withdrawAmount),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const fetchedStream = await fetchStream(streamData.id);

    assert(
      fetchedStream.amounts.withdrawn.eq(withdrawAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Withdraws - as a third party & to the Stream's recipient ATA - a third of the streamed tokens at endTime", async () => {
    const { streamData, recipient, assetMint, milestones, depositedAmount } =
      await createMintATAsAndStream(true);

    await timeTravelForwardTo(BigInt(milestones.endTime.toString()));

    const withdrawAmount = depositedAmount.div(new BN(3));
    let withdrawIx = await program.methods
      .withdraw(streamData.id, withdrawAmount)
      .accounts({
        signer: thirdPartyKeys.publicKey,
        assetMint,
        recipient,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, thirdPartyKeys);

    // Derive the recipient's ATA address
    const recipientATA = await deriveRecipientATA(assetMint);

    // Get the recipient's token balance
    const [recipientTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    assert(
      recipientTokenBalance.eq(withdrawAmount),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const fetchedStream = await fetchStream(streamData.id);

    assert(
      fetchedStream.amounts.withdrawn.eq(withdrawAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Withdraws max - as recipient - at endTime", async () => {
    const { streamData, recipient, assetMint, milestones, depositedAmount } =
      await createMintATAsAndStream(true);

    await timeTravelForwardTo(BigInt(milestones.endTime.toString()));

    let withdrawIx = await program.methods
      .withdrawMax(streamData.id)
      .accounts({
        signer: recipientKeys.publicKey,
        recipient,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, recipientKeys);

    // Derive the recipient's ATA address
    const recipientATA = await deriveRecipientATA(assetMint);

    // Get the recipient's token balance
    const [recipientTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    const expectedWithdrawnAmount = depositedAmount;
    assert(
      recipientTokenBalance.eq(expectedWithdrawnAmount),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const fetchedStream = await fetchStream(streamData.id);

    assert(
      fetchedStream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  it("Withdraws max - as a third party & to the Stream's recipient ATA - at endTime", async () => {
    const { streamData, recipient, assetMint, milestones, depositedAmount } =
      await createMintATAsAndStream(true);

    await timeTravelForwardTo(BigInt(milestones.endTime.toString()));

    let withdrawIx = await program.methods
      .withdrawMax(streamData.id)
      .accounts({
        signer: thirdPartyKeys.publicKey,
        recipient,
        assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, thirdPartyKeys);

    // Derive the recipient's ATA address
    const recipientATA = await deriveRecipientATA(assetMint);

    // Get the recipient's token balance
    const [recipientTokenBalance] = await getTokenBalancesByATAKeys(
      recipientATA
    );

    // Assert that the recipient's token balance has been changed correctly
    const expectedWithdrawnAmount = depositedAmount;
    assert(
      recipientTokenBalance.eq(expectedWithdrawnAmount),
      "The amount withdrawn to the recipient is incorrect"
    );

    // Assert that the Stream state has been updated correctly
    const fetchedStream = await fetchStream(streamData.id);

    assert(
      fetchedStream.amounts.withdrawn.eq(expectedWithdrawnAmount),
      "The Stream's withdrawn amount is incorrect"
    );
  });

  // HELPER FUNCTIONS AND DATA STRUCTS

  async function buildSignAndProcessTxFromIx(
    ix: TxIx,
    signerKeys: Keypair,
    cuLimit?: number
  ) {
    const tx =
      cuLimit === undefined
        ? await initializeTxWithIx(ix)
        : await initializeTxWithIxAndCULimit(ix, cuLimit);

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
    assetMint: PublicKey,
    timestamp: bigint
  ): Promise<void> {
    await timeTravelForwardTo(timestamp);

    let cancelStreamIx = await program.methods
      .cancel()
      .accounts({
        sender: senderKeys.publicKey,
        senderAta: senderATA,
        recipientAta: recipientATA,
        mint: assetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(cancelStreamIx, senderKeys);
  }

  async function createMintATAsAndStream(isStreamCancelable: boolean): Promise<{
    streamData: any;
    senderATA: PublicKey;
    recipient: PublicKey;
    assetMint: PublicKey;
    depositedAmount: BN;
    milestones: StreamMilestones;
  }> {
    const { assetMint, senderATA } = await createTokenAndMintToSender();
    const streamId = await deduceCurrentStreamId();

    const recipient = recipientKeys.publicKey;
    const milestones = generateStandardStreamMilestones();
    const depositedAmount = await getTokenBalanceByATAKey(senderATA);
    await createLLStreamWithTimestamps({
      senderKeys,
      recipient,
      assetMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      milestones,
      depositedAmount,
      isCancelable: isStreamCancelable,
    });

    return {
      streamData: await fetchStream(streamId),
      senderATA,
      recipient,
      assetMint,
      depositedAmount,
      milestones,
    };
  }

  async function createTokenAndMintToSender(): Promise<{
    assetMint: PublicKey;
    senderATA: PublicKey;
  }> {
    const TOKEN_DECIMALS = 2;
    const freezeAuthority = null;

    const assetMint = await createMint(
      client,
      senderKeys,
      senderKeys.publicKey,
      freezeAuthority,
      TOKEN_DECIMALS
    );

    const senderATA = await createAssociatedTokenAccount(
      client,
      senderKeys,
      assetMint,
      senderKeys.publicKey,
      TOKEN_PROGRAM_ID
    );
    console.log(`Sender's ATA: ${senderATA}`);

    const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, TOKEN_DECIMALS);
    await mintTo(
      client,
      senderKeys,
      assetMint,
      senderATA,
      senderKeys,
      10 * MINOR_UNITS_PER_MAJOR_UNITS
    );

    console.log(
      `Minted ${10 * MINOR_UNITS_PER_MAJOR_UNITS} tokens to the Sender ATA`
    );

    return { assetMint, senderATA };
  }

  async function withdrawMax(
    streamId: BN,
    txSigner: Keypair,
    recipient: PublicKey,
    assetMint: PublicKey,
    tokenProgram: PublicKey
  ) {
    let withdrawIx = await program.methods
      .withdrawMax(streamId)
      .accounts({
        signer: txSigner.publicKey,
        recipient,
        assetMint,
        tokenProgram,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(withdrawIx, txSigner);
  }

  interface PrepareForStreamCreationArgs {
    signerKeys: Keypair;
    assetMint: PublicKey;
    tokenProgram: PublicKey;
  }

  interface CreateLLStreamWithTimestampsArgs {
    senderKeys: Keypair;
    recipient: PublicKey;
    assetMint: PublicKey;
    tokenProgram: PublicKey;
    milestones: StreamMilestones;
    depositedAmount: BN;
    isCancelable: boolean;
  }

  async function createToken2022AndMintToSender(): Promise<{
    assetMint: PublicKey;
    senderATA: PublicKey;
  }> {
    const TOKEN_DECIMALS = 9;
    const freezeAuthority = null;
    const assetMint = await createMint(
      client,
      senderKeys,
      senderKeys.publicKey,
      freezeAuthority,
      TOKEN_DECIMALS,
      Keypair.generate(),
      TOKEN_2022_PROGRAM_ID
    );

    console.log(`Created Token Mint: ${assetMint}`);

    const senderATA = await createAssociatedTokenAccount(
      client,
      senderKeys,
      assetMint,
      senderKeys.publicKey,
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`Sender's ATA: ${senderATA}`);

    const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, TOKEN_DECIMALS);
    const signers: anchor.web3.Signer[] = [];
    await mintTo(
      client,
      senderKeys,
      assetMint,
      senderATA,
      senderKeys,
      10 * MINOR_UNITS_PER_MAJOR_UNITS,
      signers,
      TOKEN_2022_PROGRAM_ID
    );

    console.log(
      `Minted ${10 * MINOR_UNITS_PER_MAJOR_UNITS} tokens to the Sender ATA`
    );

    return { assetMint, senderATA };
  }

  async function createLLStreamWithTimestamps(
    args: CreateLLStreamWithTimestampsArgs
  ): Promise<void> {
    const {
      senderKeys,
      recipient,
      assetMint,
      tokenProgram,
      milestones,
      depositedAmount,
      isCancelable,
    } = args;

    await prepareForStreamCreation({
      signerKeys: senderKeys,
      assetMint,
      tokenProgram,
    });

    const totalSupply = await getNftCollectionTotalSupply(
      nftCollectionDataAddress
    );

    let createStreamIx = await program.methods
      .createWithTimestamps(
        milestones.startTime,
        milestones.cliffTime,
        milestones.endTime,
        depositedAmount,
        isCancelable
      )
      .accounts({
        sender: senderKeys.publicKey,
        assetMint,
        recipient,
        tokenProgram,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(createStreamIx, senderKeys, 270_000);

    const streamNftMint = getPDAAddress(
      [Buffer.from("stream_nft_mint"), totalSupply.toBuffer("le", 8)],
      lockup_program_id // TODO: why is the Lockup program - and not the Token Program need to be used here?
    );

    // Confirm that the Stream NFT Mint account has been initialized
    assert.ok(
      await client.getAccount(streamNftMint),
      "Stream NFT Mint not initialized"
    );

    const streamNftMintToBuffer = streamNftMint.toBuffer();

    const streamNftMetadata = getPDAAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        streamNftMintToBuffer,
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Confirm that the Stream NFT Metadata account has been initialized
    assert.ok(
      await client.getAccount(streamNftMetadata),
      "Stream NFT Metadata not initialized"
    );

    const streamNftMasterEdition = getPDAAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        streamNftMintToBuffer,
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Confirm that the Stream NFT Master account has been initialized
    assert.ok(
      await client.getAccount(streamNftMasterEdition),
      "Stream NFT Master Edition not initialized"
    );

    const sendersStreamNftATA = await deriveATAAddress(
      streamNftMint,
      senderKeys.publicKey,
      tokenProgram
    );

    // Confirm that the Sender's Stream NFT ATA has been initialized
    assert.ok(
      await client.getAccount(sendersStreamNftATA),
      "Sender's Stream NFT ATA not initialized"
    );
  }

  function getPDAAddress(
    seeds: Array<Buffer | Uint8Array>,
    programId: PublicKey
  ): PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync(seeds, programId)[0];
  }

  async function deriveRecipientATA(assetMint: PublicKey): Promise<PublicKey> {
    return deriveATAAddress(
      assetMint,
      recipientKeys.publicKey,
      TOKEN_PROGRAM_ID
    );
  }

  async function deriveRecipientATAToken2022(
    assetMint: PublicKey
  ): Promise<PublicKey> {
    return deriveATAAddress(
      assetMint,
      recipientKeys.publicKey,
      TOKEN_2022_PROGRAM_ID
    );
  }

  async function deduceCurrentStreamId(): Promise<BN> {
    const nftcollectionDataAccount = await client.getAccount(
      nftCollectionDataAddress
    );
    if (!nftcollectionDataAccount) {
      throw new Error("NFT Collection Data account is undefined");
    }

    // Return the data of NFT Collection Data decoded via the Anchor account layout
    const nftCollectionDataLayout = program.account.nftCollectionData;

    const nftCollectionData = nftCollectionDataLayout.coder.accounts.decode(
      "nftCollectionData",
      Buffer.from(nftcollectionDataAccount.data)
    );

    return nftCollectionData.nftsTotalSupply;
  }

  async function fetchStream(streamId: BN): Promise<any> {
    // The seeds used when creating the Stream NFT Mint PDA
    const streamNftMintSeeds = [
      Buffer.from("stream_nft_mint"),
      streamId.toBuffer("le", 8),
    ];
    const streamNftMintAddress = getPDAAddress(
      streamNftMintSeeds,
      lockup_program_id
    );

    // The seeds used when creating the Stream Data PDA
    const streamDataSeeds = [
      Buffer.from("LL_stream"),
      streamNftMintAddress.toBuffer(),
    ];

    const streamDataAddress = getPDAAddress(streamDataSeeds, lockup_program_id);
    const streamDataAccount = await client.getAccount(streamDataAddress);
    if (!streamDataAccount) {
      throw new Error("Stream Data account is undefined");
    }

    // Return the Stream data decoded via the Anchor account layout
    const streamLayout = program.account.streamData;

    return streamLayout.coder.accounts.decode(
      "streamData",
      Buffer.from(streamDataAccount.data)
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

  async function initializeTxWithIxAndCULimit(
    ix: TxIx,
    cuLimit: number
  ): Promise<Transaction> {
    const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: cuLimit,
    });

    return (await initializeTx()).add(cuLimitIx).add(ix);
  }

  async function initializeTx(): Promise<Transaction> {
    const res = await client.getLatestBlockhash();
    if (!res) throw new Error("Couldn't get the latest blockhash");

    let tx = new Transaction();
    tx.recentBlockhash = res[0];
    return tx;
  }

  async function prepareForStreamCreation(
    args: PrepareForStreamCreationArgs
  ): Promise<void> {
    const { signerKeys, assetMint, tokenProgram } = args;

    let createStreamIx = await program.methods
      .prepareForStreamCreation()
      .accounts({
        sender: signerKeys.publicKey,
        assetMint,
        tokenProgram,
      })
      .instruction();

    // Build, sign and process the transaction
    await buildSignAndProcessTxFromIx(createStreamIx, signerKeys);
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

  async function getNftCollectionTotalSupply(
    nftCollectionAddress: PublicKey
  ): Promise<BN> {
    const nftCollectionData = await fetchNftCollectionData(
      nftCollectionAddress
    );

    return new BN(nftCollectionData.nftsTotalSupply.toString(), 10);
  }

  async function fetchNftCollectionData(address: PublicKey): Promise<any> {
    const nftCollectionDataAcc = await client.getAccount(address);
    if (!nftCollectionDataAcc) {
      throw new Error("NFT Collection Data account is undefined");
    }

    // Return the NFT Collection Data decoded via the Anchor account layout
    const nftCollectionDataLayout = program.account.nftCollectionData;

    return nftCollectionDataLayout.coder.accounts.decode(
      "nftCollectionData",
      Buffer.from(nftCollectionDataAcc.data)
    );
  }
});
