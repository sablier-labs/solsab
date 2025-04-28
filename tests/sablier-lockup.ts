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
  getTokenBalanceByATAAccountData,
  getTotalSupplyByAccountData,
  mintTo,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  transfer,
} from "./anchor-bankrun-adapter";

import {
  StreamMilestones,
  getDefaultMilestones,
  getDefaultAccountInfoWithSOL,
  getMilestonesWithPastStartTime,
  getMilestonesWithPastCliffTime,
  getMilestonesWithPastEndTime,
  getStreamedAmountAt,
  UnlockAmounts,
  getDefaultUnlockAmounts,
  getUnlockAmountsJustStart,
  getUnlockAmountsJustCliff,
  getUnlockAmountsStartAndCliff,
} from "./utils";

import { SablierLockup } from "../target/types/sablier_lockup";
import IDL from "../target/idl/sablier_lockup.json";

let context: ProgramTestContext;
let banksClient: BanksClient;
let senderKeys: Keypair;
let recipientKeys: Keypair;
let feeCollectorKeys: Keypair;
let thirdPartyKeys: Keypair;
let bankrunProvider: BankrunProvider;
let treasuryAddress: PublicKey;
let nftCollectionDataAddress: PublicKey;
let lockupProgram: anchor.Program<SablierLockup>;
let lockupProgramId: PublicKey;

const WITHDRAWAL_FEE_LAMPORTS = BigInt(10_000_000); // 0.01 SOL

const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

function configureConsoleLogs() {
  // Suppress console logs by default
  // Dev: comment the line below to see the logs in the console (useful when debugging)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  console.log = () => {};
}

describe("SablierLockup Initialization", () => {
  beforeEach(async () => {
    configureConsoleLogs();
    await configureTestingEnvironment();
  });

  it("Fails to Initialize twice", async () => {
    await initializeSablierLockup(senderKeys);

    try {
      await initializeSablierLockup(thirdPartyKeys);

      assert.fail("The 2nd Initialize Ix should've failed");
    } catch (error) {
      assert(
        // TODO: Figure out a more robust way of checking the thrown error
        (error as Error).message.includes("custom program error: 0x0"),
        "The 2nd Initialize Ix failed with an unexpected error"
      );
    }
  });

  it("Initializes the program", async () => {
    await initializeSablierLockup(senderKeys);

    // Confirm that the Treasury account has been initialized
    assert(await accountExists(treasuryAddress), "Treasury not initialized");

    // Confirm that the NFT Collection Data account has been initialized
    assert(
      await accountExists(nftCollectionDataAddress),
      "NFT Collection Data not initialized"
    );

    const nftCollectionMint = getPDAAddress(
      [Buffer.from("nft_collection_mint")],
      lockupProgramId
    );

    // Confirm that the NFT Collection Mint account has been initialized
    assert(
      await accountExists(nftCollectionMint),
      "NFT Collection Mint not initialized"
    );

    console.log(
      "NFT Collection Mint's address: ",
      nftCollectionMint.toBase58()
    );

    // Assert that the Total Supply of the NFT Collection Mint is 1
    assert((await getMintTotalSupplyOf(nftCollectionMint)).eq(new BN(1)));

    const nftCollectionATA = deriveATAAddress(
      nftCollectionMint,
      treasuryAddress,
      TOKEN_PROGRAM_ID
    );

    // Confirm that the NFT Collection ATA has been initialized
    assert(
      await accountExists(nftCollectionATA),
      "NFT Collection ATA not initialized"
    );

    // Assert that the NFT Collection ATA balance is 1
    assert((await getTokenBalanceByATAKey(nftCollectionATA)).eq(new BN(1)));

    const nftCollectionMintAsBuffer = nftCollectionMint.toBuffer();

    const nftCollectionMetadata = getPDAAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        nftCollectionMintAsBuffer,
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    console.log(
      "NFT Collection Metadata's address: ",
      nftCollectionMetadata.toBase58()
    );

    // Confirm that the NFT Collection Metadata account has been initialized
    assert(
      await accountExists(nftCollectionMetadata),
      "NFT Collection Metadata not initialized"
    );

    const nftCollectionMasterEdition = getPDAAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        nftCollectionMintAsBuffer,
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    console.log(
      "NFT Collection Master Edition's address: ",
      nftCollectionMasterEdition.toBase58()
    );

    // Confirm that the NFT Collection Master Edition account has been initialized
    assert(
      await accountExists(nftCollectionMasterEdition),
      "NFT Collection Master Edition not initialized"
    );
  });
});

describe("SablierLockup user-callable Ixs", () => {
  beforeEach(async () => {
    configureConsoleLogs();
    await configureTestingEnvironment();
    await logInfoAboutImportantAccounts();
    await initializeSablierLockup(senderKeys);
  });

  describe("Stream Creation Tests (SPL Token)", () => {
    it("Fails to create a LL Stream with a deposited amount > sender's balance", async () => {
      const { assetMint, senderATA } = await createTokenAndMintToSender(
        TOKEN_PROGRAM_ID,
        getDefaultUnlockAmounts()
      );

      // Attempt to create a Stream with a deposited amount > sender's balance
      const depositedAmount = (await getTokenBalanceByATAKey(senderATA)).add(
        new BN(1)
      );
      const isCancelable = true;

      await assertCreateWithTimestampsFailure(
        assetMint,
        await deduceCurrentStreamId(),
        depositedAmount,
        getDefaultUnlockAmounts(),
        await getDefaultMilestones(banksClient),
        isCancelable,
        TOKEN_PROGRAM_ID,
        "0x1"
      );
    });

    it("Fails to create a LL Stream with a depositAmount = 0", async () => {
      const { assetMint } = await createTokenAndMintToSender(
        TOKEN_PROGRAM_ID,
        getDefaultUnlockAmounts()
      );

      // Attempt to create a Stream with a deposited amount of 0
      const depositedAmount = new BN(0);
      const isCancelable = true;

      await assertCreateWithTimestampsFailure(
        assetMint,
        await deduceCurrentStreamId(),
        depositedAmount,
        getDefaultUnlockAmounts(),
        await getDefaultMilestones(banksClient),
        isCancelable,
        TOKEN_PROGRAM_ID,
        "0x1776"
      );
    });

    it("Fails to create a LL Stream with an invalid token mint", async () => {
      const { senderATA } = await createTokenAndMintToSender(
        TOKEN_PROGRAM_ID,
        getDefaultUnlockAmounts()
      );

      // Create an "invalid" mint (different from that of the sender's ATA)
      const invalidAssetMint = await createMint(
        banksClient,
        senderKeys,
        senderKeys.publicKey,
        null,
        2
      );

      // Attempt to create a Stream with the invalid token mint
      const depositedAmount = await getTokenBalanceByATAKey(senderATA);
      const isCancelable = true;

      await assertCreateWithTimestampsFailure(
        invalidAssetMint,
        await deduceCurrentStreamId(),
        depositedAmount,
        getDefaultUnlockAmounts(),
        await getDefaultMilestones(banksClient),
        isCancelable,
        TOKEN_PROGRAM_ID,
        "0xbc4"
      );
    });

    it("Fails to create a LL Stream when cliffTime < startTime", async () => {
      const { assetMint, senderATA } = await createTokenAndMintToSender(
        TOKEN_PROGRAM_ID,
        getDefaultUnlockAmounts()
      );

      // Attempt to create a Stream with cliffTime < startTime
      const milestones = await getDefaultMilestones(banksClient);
      milestones.cliffTime = milestones.startTime.sub(new BN(1));
      const depositedAmount = await getTokenBalanceByATAKey(senderATA);
      const isCancelable = true;

      await assertCreateWithTimestampsFailure(
        assetMint,
        await deduceCurrentStreamId(),
        depositedAmount,
        getDefaultUnlockAmounts(),
        milestones,
        isCancelable,
        TOKEN_PROGRAM_ID,
        "0x1778"
      );
    });

    it("Fails to create a LL Stream when cliffTime == startTime", async () => {
      const { assetMint, senderATA } = await createTokenAndMintToSender(
        TOKEN_PROGRAM_ID,
        getDefaultUnlockAmounts()
      );

      // Attempt to create a Stream with cliffTime < startTime
      const milestones = await getDefaultMilestones(banksClient);
      milestones.cliffTime = milestones.startTime;
      const depositedAmount = await getTokenBalanceByATAKey(senderATA);
      const isCancelable = true;

      await assertCreateWithTimestampsFailure(
        assetMint,
        await deduceCurrentStreamId(),
        depositedAmount,
        getDefaultUnlockAmounts(),
        milestones,
        isCancelable,
        TOKEN_PROGRAM_ID,
        "0x1778"
      );
    });

    it("Fails to create a LL Stream when cliffTime > endTime", async () => {
      const { assetMint, senderATA } = await createTokenAndMintToSender(
        TOKEN_PROGRAM_ID,
        getDefaultUnlockAmounts()
      );

      // Attempt to create a Stream with cliffTime > endTime
      const milestones = await getDefaultMilestones(banksClient);
      milestones.cliffTime = milestones.endTime.add(new BN(1));
      const depositedAmount = await getTokenBalanceByATAKey(senderATA);
      const isCancelable = true;

      await assertCreateWithTimestampsFailure(
        assetMint,
        await deduceCurrentStreamId(),
        depositedAmount,
        getDefaultUnlockAmounts(),
        milestones,
        isCancelable,
        TOKEN_PROGRAM_ID,
        "0x1775"
      );
    });

    it("Fails to create a LL Stream when cliffTime == endTime", async () => {
      const { assetMint, senderATA } = await createTokenAndMintToSender(
        TOKEN_PROGRAM_ID,
        getDefaultUnlockAmounts()
      );

      // Attempt to create a Stream with cliffTime > endTime
      const milestones = await getDefaultMilestones(banksClient);
      milestones.cliffTime = milestones.endTime;
      const depositedAmount = await getTokenBalanceByATAKey(senderATA);
      const isCancelable = true;

      await assertCreateWithTimestampsFailure(
        assetMint,
        await deduceCurrentStreamId(),
        depositedAmount,
        getDefaultUnlockAmounts(),
        milestones,
        isCancelable,
        TOKEN_PROGRAM_ID,
        "0x1775"
      );
    });

    it("Fails to create a LL Stream when endTime < startTime", async () => {
      const { assetMint, senderATA } = await createTokenAndMintToSender(
        TOKEN_PROGRAM_ID,
        getDefaultUnlockAmounts()
      );

      // Attempt to create a Stream with endTime < startTime
      const milestones = await getDefaultMilestones(banksClient);
      milestones.endTime = milestones.startTime.sub(new BN(1));
      const depositedAmount = await getTokenBalanceByATAKey(senderATA);
      const isCancelable = true;

      await assertCreateWithTimestampsFailure(
        assetMint,
        await deduceCurrentStreamId(),
        depositedAmount,
        getDefaultUnlockAmounts(),
        milestones,
        isCancelable,
        TOKEN_PROGRAM_ID,
        "0x1779"
      );
    });

    it("Creates a cancelable SPL Token LL Stream", async () => {
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts()
      );
    });

    it("Creates 3 cancelable SPL Token LL Streams", async () => {
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts()
      );
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts()
      );
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts()
      );
    });

    it("Creates multiple SPL Token LL Streams in a single tx", async () => {
      await testMultiStreamCreationInOneTx(
        TOKEN_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient)
      );
    });

    it("Creates a cancelable SPL Token LL Stream with a past startTime", async () => {
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getMilestonesWithPastStartTime(banksClient),
        getDefaultUnlockAmounts()
      );
    });

    it("Creates a cancelable SPL Token LL Stream with a past cliffTime", async () => {
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getMilestonesWithPastCliffTime(banksClient),
        getDefaultUnlockAmounts()
      );
    });

    it("Creates a cancelable SPL Token LL Stream with a past endTime", async () => {
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getMilestonesWithPastEndTime(banksClient),
        getDefaultUnlockAmounts()
      );
    });

    it("Creates a cancelable SPL Token Start-Unlock LL Stream", async () => {
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getUnlockAmountsJustStart()
      );
    });

    it("Creates a cancelable SPL Token Cliff-Unlock LL Stream", async () => {
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getUnlockAmountsJustCliff()
      );
    });

    it("Creates a cancelable SPL Token StartCliff-Unlock LL Stream", async () => {
      await testStreamCreation(
        TOKEN_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getUnlockAmountsStartAndCliff()
      );
    });
  });

  describe("Stream Creation Tests (Token2022)", () => {
    it("Creates a cancelable Token2022 LL Stream", async () => {
      await testStreamCreation(
        TOKEN_2022_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts()
      );
    });

    it("Creates 3 cancelable Token2022 Streams", async () => {
      await testStreamCreation(
        TOKEN_2022_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts()
      );
      await testStreamCreation(
        TOKEN_2022_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts()
      );
      await testStreamCreation(
        TOKEN_2022_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts()
      );
    });

    it("Creates a cancelable Token2022 Start-Unlock LL Stream", async () => {
      await testStreamCreation(
        TOKEN_2022_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getUnlockAmountsJustStart()
      );
    });

    it("Creates a cancelable Token2022 Cliff-Unlock LL Stream", async () => {
      await testStreamCreation(
        TOKEN_2022_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getUnlockAmountsJustCliff()
      );
    });

    it("Creates a cancelable Token2022 StartCliff-Unlock LL Stream", async () => {
      await testStreamCreation(
        TOKEN_2022_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient),
        getUnlockAmountsStartAndCliff()
      );
    });

    it("Creates multiple Token2022 LL Streams in a single tx", async () => {
      await testMultiStreamCreationInOneTx(
        TOKEN_2022_PROGRAM_ID,
        true,
        await getDefaultMilestones(banksClient)
      );
    });
  });

  describe("Stream Transfer Tests (SPL Token)", () => {
    it("Fails to transfer someone else's SPL Token Stream", async () => {
      await createStreamAndAssertThirdPartyStreamTransferFailure(
        TOKEN_PROGRAM_ID
      );
    });

    it("Transfers a cancelable SPL Token LL Stream to a third party", async () => {
      await createStreamAndTestTransferability(
        TOKEN_PROGRAM_ID,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        true
      );
    });

    it("Transfers a non-cancelable SPL Token LL Stream to a third party", async () => {
      await createStreamAndTestTransferability(
        TOKEN_PROGRAM_ID,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        false
      );
    });
  });

  describe("Stream Transfer Tests (Token2022)", () => {
    it("Fails to transfer someone else's Token2022 Stream", async () => {
      await createStreamAndAssertThirdPartyStreamTransferFailure(
        TOKEN_2022_PROGRAM_ID
      );
    });

    it("Transfers a cancelable Token2022 LL Stream to a third party", async () => {
      await createStreamAndTestTransferability(
        TOKEN_2022_PROGRAM_ID,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        true
      );
    });

    it("Transfers a non-cancelable SPL Token LL Stream to a third party", async () => {
      await createStreamAndTestTransferability(
        TOKEN_2022_PROGRAM_ID,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        false
      );
    });
  });

  describe("Cancelability Renouncement Tests (SPL Token)", () => {
    it("Fails to renounce cancelability when the Stream is not cancelable", async () => {
      const { streamData } = await createMintATAsAndStream(
        false,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        TOKEN_PROGRAM_ID
      );

      await assertCancelabilityRenouncementFailure(
        streamData.id,
        "custom program error: 0x177b"
      );
    });

    it("Fails to renounce cancelability when tx signer != Stream's sender", async () => {
      const { streamData } = await createMintATAsAndStream(
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        TOKEN_PROGRAM_ID
      );

      await assertCancelabilityRenouncementFailure(
        streamData.id,
        "Signature verification failed",
        recipientKeys
      );
    });

    it("Renounces the cancelability of a cancelable SPL Token LL Stream", async () => {
      await createStreamAndTestRenouncement(
        senderKeys,
        true,
        await getDefaultMilestones(banksClient),
        TOKEN_PROGRAM_ID
      );
    });

    it("Renounces the cancelability of a cancelable SPL Token LL Stream with a past startTime", async () => {
      await createStreamAndTestRenouncement(
        senderKeys,
        true,
        await getMilestonesWithPastStartTime(banksClient),
        TOKEN_PROGRAM_ID
      );
    });

    it("Renounces the cancelability of a cancelable SPL Token LL Stream with a past cliffTime", async () => {
      await createStreamAndTestRenouncement(
        senderKeys,
        true,
        await getMilestonesWithPastCliffTime(banksClient),
        TOKEN_PROGRAM_ID
      );
    });

    it("Renounces the cancelability of a cancelable SPL Token LL Stream with a past endTime", async () => {
      await createStreamAndTestRenouncement(
        senderKeys,
        true,
        await getMilestonesWithPastEndTime(banksClient),
        TOKEN_PROGRAM_ID
      );
    });
  });

  describe("Cancelability Renouncement Tests (Token2022)", () => {
    it("Renounces the cancelability of a cancelable Token2022 LL Stream", async () => {
      await createStreamAndTestRenouncement(
        senderKeys,
        true,
        await getDefaultMilestones(banksClient),
        TOKEN_2022_PROGRAM_ID
      );
    });

    it("Renounces the cancelability of a cancelable Token2022 LL Stream with a past startTime", async () => {
      await createStreamAndTestRenouncement(
        senderKeys,
        true,
        await getMilestonesWithPastStartTime(banksClient),
        TOKEN_2022_PROGRAM_ID
      );
    });

    it("Renounces the cancelability of a cancelable Token2022 LL Stream with a past cliffTime", async () => {
      await createStreamAndTestRenouncement(
        senderKeys,
        true,
        await getMilestonesWithPastCliffTime(banksClient),
        TOKEN_2022_PROGRAM_ID
      );
    });

    it("Renounces the cancelability of a cancelable Token2022 LL Stream with a past endTime", async () => {
      await createStreamAndTestRenouncement(
        senderKeys,
        true,
        await getMilestonesWithPastEndTime(banksClient),
        TOKEN_2022_PROGRAM_ID
      );
    });
  });

  describe("Cancel Tests (SPL Token)", () => {
    it("Fails to cancel a Stream that doesn't exist", async () => {
      const depositTokenProgram = TOKEN_PROGRAM_ID;

      const { streamData, assetMint } = await createMintATAsAndStream(
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        depositTokenProgram
      );

      const wrongStreamId = streamData.id.add(new BN(1));
      await assertStreamCancelationFailure(
        recipientKeys,
        wrongStreamId,
        assetMint,
        depositTokenProgram,
        "custom program error: 0xbc4"
      );
    });

    it("Fails to cancel a non-cancelable Stream", async () => {
      const depositTokenProgram = TOKEN_PROGRAM_ID;

      const { streamData, assetMint } = await createMintATAsAndStream(
        false,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        depositTokenProgram
      );

      await assertStreamCancelationFailure(
        senderKeys,
        streamData.id,
        assetMint,
        depositTokenProgram,
        "custom program error: 0x1771"
      );
    });

    it("Fails to cancel a SETTLED Stream", async () => {
      const depositTokenProgram = TOKEN_PROGRAM_ID;

      const { streamData, assetMint } = await createMintATAsAndStream(
        true,
        await getMilestonesWithPastEndTime(banksClient),
        getDefaultUnlockAmounts(),
        depositTokenProgram
      );

      await assertStreamCancelationFailure(
        senderKeys,
        streamData.id,
        assetMint,
        depositTokenProgram,
        "custom program error: 0x1772"
      );
    });

    it("Fails to cancel an SPL Token LL Stream when a wrong asset mint is submitted", async () => {
      const depositTokenProgram = TOKEN_PROGRAM_ID;

      const { streamData } = await createMintATAsAndStream(
        false,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        depositTokenProgram
      );

      // Create a wrong asset mint
      const wrongAssetMint = await createMint(
        banksClient,
        senderKeys,
        senderKeys.publicKey,
        null,
        2,
        Keypair.generate(),
        depositTokenProgram
      );

      // Create the Sender's ATA for the wrong assetMint (so that the Tx doesn't fail because of this)
      await createAssociatedTokenAccount(
        banksClient,
        senderKeys,
        wrongAssetMint,
        senderKeys.publicKey,
        depositTokenProgram
      );

      // Create the Treasury's ATA for the wrong assetMint (so that the Tx doesn't fail because of this)
      await createAssociatedTokenAccount(
        banksClient,
        senderKeys,
        wrongAssetMint,
        treasuryAddress,
        depositTokenProgram
      );

      await assertStreamCancelationFailure(
        senderKeys,
        streamData.id,
        wrongAssetMint,
        depositTokenProgram,
        "custom program error: 0x7dc"
      );
    });

    it("Cancels a PENDING Stream, SPL Token", async () => {
      await createStreamAndTestCancelability(
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        TOKEN_PROGRAM_ID
      );
    });

    it("Cancels a STREAMING Stream, SPL Token", async () => {
      await createStreamAndTestCancelability(
        await getMilestonesWithPastCliffTime(banksClient),
        getDefaultUnlockAmounts(),
        TOKEN_PROGRAM_ID
      );
    });
  });

  describe("Cancel Tests (Token2022)", () => {
    it("Cancels a PENDING Stream, Token2022", async () => {
      await createStreamAndTestCancelability(
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        TOKEN_2022_PROGRAM_ID
      );
    });

    it("Cancels a SETTLED Stream, Token2022", async () => {
      await createStreamAndTestCancelability(
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        TOKEN_2022_PROGRAM_ID
      );
    });

    it("Cancels a STREAMING Stream, Token2022", async () => {
      await createStreamAndTestCancelability(
        await getMilestonesWithPastStartTime(banksClient),
        getDefaultUnlockAmounts(),
        TOKEN_2022_PROGRAM_ID
      );
    });
  });

  describe("Withdraw Tests (SPL Token)", () => {
    it("Fails to withdraw from an SPL Token LL Stream - as recipient - an amount > streamed amount", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime.sub(new BN(1)),
        WithdrawalSize.EntireDeposit,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw from an SPL Token LL Stream - as recipient - a 0 amount", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.ZERO,
        AssetMintKind.Correct,
        "custom program error: 0x177d"
      );
    });

    it("Fails to withdraw from an SPL Token LL Stream - as recipient - before cliffTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.cliffTime.sub(new BN(1)),
        WithdrawalSize.OneToken,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw from an SPL Token LL Stream - as a non-recipient & to a non-recipient ATA - a third of the streamed tokens at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        senderKeys,
        senderKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.OneThirdOfDeposited,
        AssetMintKind.Correct,
        "custom program error: 0xbc4"
      );
    });

    it("Fails to withdraw the start unlock amount + 1 tokens from a Start-Unlock SPL Token LL Stream - as recipient - at start time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustStart(),
        milestones.startTime,
        WithdrawalSize.StartUnlockPlusOne,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw the cliff unlock amount + 1 tokens from a Cliff-Unlock SPL Token LL Stream - as recipient - at cliff time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustCliff(),
        milestones.cliffTime,
        WithdrawalSize.CliffUnlockPlusOne,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw the start+cliff unlock amount + 1 tokens from a StartCliff-Unlock SPL Token LL Stream - as recipient - at cliff time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsStartAndCliff(),
        milestones.startTime,
        WithdrawalSize.StartAndCliffUnlocksPlusOne,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw from an SPL Token LL Stream - as recipient - when a wrong asset mint is submitted", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsStartAndCliff(),
        milestones.startTime,
        WithdrawalSize.OneToken,
        AssetMintKind.Wrong,
        "custom program error: 0x7dc"
      );
    });

    it("Withdraws from an SPL Token LL Stream - as a non-recipient & to the Stream's recipient ATA - a third of the streamed tokens at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        thirdPartyKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.OneThirdOfDeposited
      );
    });

    it("Withdraws from an SPL Token LL Stream - as recipient - a third of the streamed tokens at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.OneThirdOfDeposited
      );
    });

    it("Withdraws from an SPL Token LL Stream - as recipient - at half time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.startTime.add(milestones.endTime).div(new BN(2)),
        WithdrawalSize.HalfOfDeposited
      );
    });

    it("Withdraws from an SPL Token LL Stream - as recipient - after the Stream has been canceled at half time", async () => {
      await testForWithdrawalPostCancelAtHalfTime(
        TOKEN_PROGRAM_ID,
        WithdrawalKind.Withdraw
      );
    });

    it("Withdraws from an SPL Token LL Stream - as recipient - after the Stream cancelability has been renounced at half time", async () => {
      await testForWithdrawalPostRenounceAtHalfTime(
        TOKEN_PROGRAM_ID,
        WithdrawalKind.Withdraw
      );
    });

    it("Old recipient fails & new recipient succeeds to withdraw 1 token at endTime after an SPL Token LL Stream has been transferred", async () => {
      await testForWithdrawalAfterStreamTransfer(
        WithdrawalSize.OneToken,
        TOKEN_PROGRAM_ID
      );
    });

    it("Withdraws from a Start-Unlock SPL Token LL Stream - as recipient - at start time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustStart(),
        milestones.startTime,
        WithdrawalSize.StartUnlock
      );
    });

    it("Withdraws from a Start-Unlock SPL Token LL Stream - as recipient - at half time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustStart(),
        milestones.startTime.add(milestones.endTime).div(new BN(2)),
        WithdrawalSize.StreamedAmount
      );
    });

    it("Withdraws from a Cliff-Unlock SPL Token LL Stream - as recipient - at cliff time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustCliff(),
        milestones.cliffTime,
        WithdrawalSize.CliffUnlock
      );
    });

    it("Withdraws cliff unlock from a Cliff-Unlock SPL Token LL Stream - as a non-recipient & to the recipient ATA - at half time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        thirdPartyKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustCliff(),
        milestones.startTime.add(milestones.endTime).div(new BN(2)),
        WithdrawalSize.CliffUnlock
      );
    });

    it("Withdraws from a StartCliff-Unlock SPL Token LL Stream - as recipient - at cliff time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsStartAndCliff(),
        milestones.cliffTime,
        WithdrawalSize.StartAndCliffUnlocks
      );
    });

    it("Withdraws from a StartCliff-Unlock SPL Token LL Stream - as recipient - at end time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getUnlockAmountsStartAndCliff(),
        milestones.endTime,
        WithdrawalSize.EntireDeposit
      );
    });
  });

  describe("Withdraw Tests (Token2022)", () => {
    it("Fails to withdraw from a Token2022 LL Stream - as recipient - an amount > streamed amount", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime.sub(new BN(1)),
        WithdrawalSize.EntireDeposit,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw from a Token2022 LL Stream - as recipient - a 0 amount", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.ZERO,
        AssetMintKind.Correct,
        "custom program error: 0x177d"
      );
    });

    it("Fails to withdraw from a Token2022 LL Stream - as recipient - before cliffTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.cliffTime.sub(new BN(1)),
        WithdrawalSize.OneToken,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw from a Token2022 LL Stream - as a non-recipient & to a non-recipient ATA - a third of the streamed tokens at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        senderKeys,
        senderKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.OneThirdOfDeposited,
        AssetMintKind.Correct,
        "custom program error: 0xbc4"
      );
    });

    it("Fails to withdraw the start unlock amount + 1 tokens from a Start-Unlock Token2022 LL Stream - as recipient - at start time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustStart(),
        milestones.startTime,
        WithdrawalSize.StartUnlockPlusOne,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw the cliff unlock amount + 1 tokens from a Cliff-Unlock Token2022 LL Stream - as recipient - at cliff time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustCliff(),
        milestones.cliffTime,
        WithdrawalSize.CliffUnlockPlusOne,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw the start+cliff unlock amount + 1 tokens from a StartCliff-Unlock Token2022 LL Stream - as recipient - at cliff time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsStartAndCliff(),
        milestones.startTime,
        WithdrawalSize.StartAndCliffUnlocksPlusOne,
        AssetMintKind.Correct,
        "custom program error: 0x177c"
      );
    });

    it("Fails to withdraw from a Token2022 LL Stream - as recipient - when a wrong asset mint is submitted", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsStartAndCliff(),
        milestones.startTime,
        WithdrawalSize.OneToken,
        AssetMintKind.Wrong,
        "custom program error: 0x7dc"
      );
    });

    it("Withdraws from a Token2022 LL Stream - as a non-recipient & to the Stream's recipient ATA - a third of the streamed tokens at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        thirdPartyKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.OneThirdOfDeposited
      );
    });

    it("Withdraws from a Token2022 LL Stream - as recipient - a third of the streamed tokens at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.OneThirdOfDeposited
      );
    });

    it("Withdraws from a Token2022 LL Stream - as recipient - at half time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.startTime.add(milestones.endTime).div(new BN(2)),
        WithdrawalSize.HalfOfDeposited
      );
    });

    it("Withdraws from a Token2022 LL Stream - as recipient - after the Stream has been canceled at half time", async () => {
      await testForWithdrawalPostCancelAtHalfTime(
        TOKEN_2022_PROGRAM_ID,
        WithdrawalKind.Withdraw
      );
    });

    it("Withdraws from a Token2022 LL Stream - as recipient - after the Stream cancelability has been renounced at half time", async () => {
      await testForWithdrawalPostRenounceAtHalfTime(
        TOKEN_2022_PROGRAM_ID,
        WithdrawalKind.Withdraw
      );
    });

    it("Old recipient fails & new recipient succeeds to withdraw 1 token at endTime after a Token2022 LL Stream has been transferred", async () => {
      await testForWithdrawalAfterStreamTransfer(
        WithdrawalSize.OneToken,
        TOKEN_2022_PROGRAM_ID
      );
    });

    it("Withdraws from a Start-Unlock Token2022 LL Stream - as recipient - at start time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustStart(),
        milestones.startTime,
        WithdrawalSize.StartUnlock
      );
    });

    it("Withdraws from a Start-Unlock Token2022 LL Stream - as recipient - at half time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustStart(),
        milestones.startTime.add(milestones.endTime).div(new BN(2)),
        WithdrawalSize.StreamedAmount
      );
    });

    it("Withdraws from a Cliff-Unlock Token2022 LL Stream - as recipient - at cliff time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustCliff(),
        milestones.cliffTime,
        WithdrawalSize.CliffUnlock
      );
    });

    it("Withdraws cliff unlock from a Cliff-Unlock Token2022 LL Stream - as a non-recipient & to the recipient ATA - at half time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        thirdPartyKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsJustCliff(),
        milestones.startTime.add(milestones.endTime).div(new BN(2)),
        WithdrawalSize.CliffUnlock
      );
    });

    it("Withdraws from a StartCliff-Unlock Token2022 LL Stream - as recipient - at cliff time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsStartAndCliff(),
        milestones.cliffTime,
        WithdrawalSize.StartAndCliffUnlocks
      );
    });

    it("Withdraws from a StartCliff-Unlock Token2022 LL Stream - as recipient - at end time", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getUnlockAmountsStartAndCliff(),
        milestones.endTime,
        WithdrawalSize.EntireDeposit
      );
    });
  });

  describe("Withdraw Max Tests (SPL Token)", () => {
    it("Fails to withdraw max from an SPL Token LL Stream - as a non-recipient & to a non-recipient ATA - at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        senderKeys,
        senderKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.MAX,
        AssetMintKind.Correct,
        "custom program error: 0xbc4"
      );
    });

    it("Withdraws max from an SPL Token LL Stream - as a non-recipient & to the Stream's recipient ATA - at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        thirdPartyKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.MAX
      );
    });

    it("Fails to withdraw max from an SPL Token LL Stream - as recipient - before cliffTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.cliffTime.sub(new BN(1)),
        WithdrawalSize.MAX,
        AssetMintKind.Correct,
        "custom program error: 0x177d"
      );
    });

    it("Withdraws max from an SPL Token LL Stream - as recipient - when half of the tokens have been streamed", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.HalfOfDeposited
      );
    });

    it("Withdraws max from an SPL Token LL Stream - as recipient - after the Stream has been canceled at half time", async () => {
      await testForWithdrawalPostCancelAtHalfTime(
        TOKEN_PROGRAM_ID,
        WithdrawalKind.WithdrawMax
      );
    });

    it("Withdraws max from an SPL Token LL Stream - as recipient - after the Stream cancelability has been renounced at half time", async () => {
      await testForWithdrawalPostRenounceAtHalfTime(
        TOKEN_PROGRAM_ID,
        WithdrawalKind.WithdrawMax
      );
    });

    it("Withdraws max from an SPL Token LL Stream - as recipient - at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.MAX
      );
    });

    it("Old recipient fails & new recipient succeeds to withdraw max at endTime after an SPL Token LL Stream has been transferred", async () => {
      await testForWithdrawalAfterStreamTransfer(
        WithdrawalSize.MAX,
        TOKEN_PROGRAM_ID
      );
    });
  });

  describe("Withdraw Max Tests (Token2022)", () => {
    it("Fails to withdraw max from a Token2022 LL Stream - as a non-recipient & to a non-recipient ATA - at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        senderKeys,
        senderKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.MAX,
        AssetMintKind.Correct,
        "custom program error: 0xbc4"
      );
    });

    it("Withdraws max from a Token2022 LL Stream - as a non-recipient & to the Stream's recipient ATA - at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        thirdPartyKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.MAX
      );
    });

    it("Fails to withdraw max from a Token2022 LL Stream - as recipient - before cliffTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForFailureToWithdraw(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.cliffTime.sub(new BN(1)),
        WithdrawalSize.MAX,
        AssetMintKind.Correct,
        "custom program error: 0x177d"
      );
    });

    it("Withdraws max from a Token2022 LL Stream - as recipient - when half of the tokens have been streamed", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.HalfOfDeposited
      );
    });

    it("Withdraws max from a Token2022 LL Stream - as recipient - after the Stream has been canceled at half time", async () => {
      await testForWithdrawalPostCancelAtHalfTime(
        TOKEN_2022_PROGRAM_ID,
        WithdrawalKind.WithdrawMax
      );
    });

    it("Withdraws max from a Token2022 LL Stream - as recipient - after the Stream cancelability has been renounced at half time", async () => {
      await testForWithdrawalPostRenounceAtHalfTime(
        TOKEN_2022_PROGRAM_ID,
        WithdrawalKind.WithdrawMax
      );
    });

    it("Withdraws max from a Token2022 LL Stream - as recipient - at endTime", async () => {
      const milestones = await getDefaultMilestones(banksClient);
      await testForWithdrawal(
        recipientKeys,
        recipientKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        milestones,
        getDefaultUnlockAmounts(),
        milestones.endTime,
        WithdrawalSize.MAX
      );
    });

    it("Old recipient fails & new recipient succeeds to withdraw max at endTime after a Token2022 LL Stream has been transferred", async () => {
      await testForWithdrawalAfterStreamTransfer(
        WithdrawalSize.MAX,
        TOKEN_2022_PROGRAM_ID
      );
    });
  });

  describe("Collect Fees tests (SPL Token)", () => {
    it("Fails to collect the fees - as the fee collector - before any Stream has been created", async () => {
      await testForFailureToCollectFees(
        BeforeFeeCollection.DoNothing,
        feeCollectorKeys,
        thirdPartyKeys.publicKey,
        TOKEN_PROGRAM_ID,
        "0x1773"
      );
    });

    it("Fails to collect the fees - as the fee collector - before any withdrawal has been made", async () => {
      await testForFailureToCollectFees(
        BeforeFeeCollection.CreateStream,
        feeCollectorKeys,
        thirdPartyKeys.publicKey,
        TOKEN_PROGRAM_ID,
        "0x1773"
      );
    });

    it("Fails to collect the fees - as a 3rd party - after a withdrawal from an SPL Token Stream", async () => {
      await testForFailureToCollectFees(
        BeforeFeeCollection.CreateStreamAndWithdrawMax,
        thirdPartyKeys,
        thirdPartyKeys.publicKey,
        TOKEN_PROGRAM_ID,
        "0x7dc"
      );
    });

    it("Collects all fees - as the fee collector - after a withdrawal from an SPL Token Stream", async () => {
      await testForFeeCollection(1, TOKEN_PROGRAM_ID);
    });

    it("Collects all fees - as the fee collector - after multiple withdrawals from SPL Token Streams", async () => {
      await testForFeeCollection(3, TOKEN_PROGRAM_ID);
    });
  });

  describe("Collect Fees tests (Token2022)", () => {
    it("Fails to collect the fees - as the fee collector - before any withdrawal has been made", async () => {
      await testForFailureToCollectFees(
        BeforeFeeCollection.CreateStream,
        feeCollectorKeys,
        thirdPartyKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        "0x1773"
      );
    });

    it("Fails to collect the fees - as a 3rd party - after a withdrawal from a Token2022 Stream", async () => {
      await testForFailureToCollectFees(
        BeforeFeeCollection.CreateStreamAndWithdrawMax,
        thirdPartyKeys,
        thirdPartyKeys.publicKey,
        TOKEN_2022_PROGRAM_ID,
        "0x7dc"
      );
    });

    it("Collects all fees - as the fee collector - after a withdrawal from a Token2022 Stream", async () => {
      await testForFeeCollection(1, TOKEN_2022_PROGRAM_ID);
    });

    it("Collects all fees - as the fee collector - after multiple withdrawals from Token2022 Streams", async () => {
      await testForFeeCollection(3, TOKEN_2022_PROGRAM_ID);
    });
  });
});

// HELPER FUNCTIONS AND DATA STRUCTS

async function configureTestingEnvironment() {
  // Configure the testing environment
  context = await startAnchor(
    "",
    [
      {
        name: "sablier_lockup",
        programId: new PublicKey(IDL.address),
      },
      {
        name: "token_metadata_program",
        programId: TOKEN_METADATA_PROGRAM_ID,
      },
    ],
    []
  );
  banksClient = context.banksClient;

  bankrunProvider = new BankrunProvider(context);
  lockupProgram = new anchor.Program<SablierLockup>(IDL, bankrunProvider);
  lockupProgramId = lockupProgram.programId;

  // Initialize the accounts involved in the tests
  senderKeys = bankrunProvider.wallet.payer;
  recipientKeys = await generateAccWithSOL(context);
  feeCollectorKeys = await generateAccWithSOL(context);
  thirdPartyKeys = await generateAccWithSOL(context);

  // Pre-calculate the address of the Treasury
  treasuryAddress = getPDAAddress([Buffer.from("treasury")], lockupProgramId);
  console.log("Treasury's address: ", treasuryAddress.toBase58());

  // Pre-calculate the address of the NFT Collection Data
  nftCollectionDataAddress = getPDAAddress(
    [Buffer.from("nft_collection_data")],
    lockupProgramId
  );
}

async function logInfoAboutImportantAccounts() {
  // Output the sender's public key
  console.log(`Sender: ${senderKeys.publicKey}`);

  // Output the sender's SOL balance
  const sendersBalance = await getSOLBalanceOf(senderKeys.publicKey);
  console.log(`Sender's balance: ${sendersBalance.toString()} SOL`);

  // Output the recipient's public key
  console.log(`Recipient: ${recipientKeys.publicKey}`);

  // Output the recipient's SOL balance
  const recipientsBalance = await getSOLBalanceOf(recipientKeys.publicKey);
  console.log(`Recipient's balance: ${recipientsBalance.toString()} SOL`);

  // Output the fee collector's public key
  console.log(`Fee collector: ${feeCollectorKeys.publicKey}`);

  // Output the fee collector's SOL balance
  // const feeCollectorsBalance = getSOLBalanceOf(feeCollectorKeys.publicKey);

  // Output the third party's public key
  console.log(`Third party: ${thirdPartyKeys.publicKey}`);

  // Output the third party's SOL balance
  const thirdPartyBalance = await getSOLBalanceOf(thirdPartyKeys.publicKey);
  console.log(`Third party's balance: ${thirdPartyBalance.toString()} SOL`);

  console.log("Treasury's address: ", treasuryAddress.toBase58());

  console.log(
    "NFT Collection Data's address: ",
    nftCollectionDataAddress.toBase58()
  );
}

async function initializeSablierLockup(txSigner: Keypair) {
  const initializeIx = await getInitializeIx(txSigner.publicKey);

  await buildSignAndProcessTx(initializeIx, txSigner);
}

async function getInitializeIx(txSigner: PublicKey): Promise<TxIx> {
  return await lockupProgram.methods
    .initialize(feeCollectorKeys.publicKey)
    .accounts({
      deployer: txSigner,
      nftTokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

async function assertFeeCollectionFailure(
  txSigner: Keypair,
  feesRecipient: PublicKey,
  expectedErrorCode: string
) {
  try {
    await collectFees(txSigner, feesRecipient);
    assert.fail("The Fee Collection should've failed, but it didn't.");
  } catch (error) {
    assert(
      // TODO: Figure out a more robust way of checking the thrown error
      (error as Error).message.includes(
        `custom program error: ${expectedErrorCode}`
      ),
      "The Fee Collection failed with an unexpected error"
    );
  }
}

async function assertCreateWithTimestampsFailure(
  assetMint: PublicKey,
  expectedStreamId: BN,
  depositedAmount: BN,
  unlockAmounts: UnlockAmounts,
  milestones: StreamMilestones,
  isCancelable: boolean,
  depositTokenProgram: PublicKey,
  expectedErrorCode: string
) {
  try {
    await createWithTimestamps({
      senderKeys,
      recipient: recipientKeys.publicKey,
      assetMint,
      expectedStreamId,
      depositTokenProgram,
      milestones,
      depositedAmount,
      unlockAmounts,
      isCancelable,
    });
    assert.fail("CreateWithTimestamps should've failed, but it didn't.");
  } catch (error) {
    assert(
      // TODO: Figure out a more robust way of checking the thrown error
      (error as Error).message.includes(
        `custom program error: ${expectedErrorCode}`
      ),
      "CreateWithTimestamps failed with an unexpected error"
    );
  }
}

async function assertCancelabilityRenouncementFailure(
  streamId: BN,
  expectedError: string,
  txSigner: Keypair = senderKeys
) {
  const renounceStreamIx = await lockupProgram.methods
    .renounce(streamId)
    .accounts({
      sender: senderKeys.publicKey,
    })
    .instruction();

  try {
    await buildSignAndProcessTx(renounceStreamIx, txSigner);
    assert.fail("The Stream cancelability renouncement should've failed");
  } catch (error) {
    assert(
      // TODO: Figure out a more robust way of checking the thrown error
      (error as Error).message.includes(expectedError),
      "The Stream cancelability renouncement failed with an unexpected error"
    );
  }
}

async function assertStreamCancelationFailure(
  streamSender: Keypair,
  streamId: BN,
  assetMint: PublicKey,
  depositTokenProgram: PublicKey,
  expectedError: string
) {
  const cancelStreamIx = await lockupProgram.methods
    .cancel(streamId)
    .accounts({
      sender: streamSender.publicKey,
      assetMint,
      depositTokenProgram,
    })
    .instruction();

  try {
    await buildSignAndProcessTx(cancelStreamIx, streamSender);
    assert.fail("The Stream cancelation should've failed, but it didn't");
  } catch (error) {
    assert(
      // TODO: Figure out a more robust way of checking the thrown error
      (error as Error).message.includes(expectedError),
      "The Stream cancelation failed with an unexpected error"
    );
  }
}

async function createStreamAndAssertThirdPartyStreamTransferFailure(
  depositTokenProgram: PublicKey
) {
  const {
    recipientStreamNftATA: streamNftATA,
    streamNftMint,
    nftTokenProgram,
  } = await createMintATAsAndStream(
    true,
    await getDefaultMilestones(banksClient),
    getDefaultUnlockAmounts(),
    depositTokenProgram
  );

  try {
    await transferStreamNft(
      thirdPartyKeys,
      streamNftATA,
      thirdPartyKeys.publicKey,
      streamNftMint,
      nftTokenProgram
    );

    assert.fail("The Stream transfer should've failed, but it didn't");
  } catch (error) {
    assert(
      // TODO: Figure out a more robust way of checking the thrown error
      (error as Error).message.includes("custom program error: 0x4"),
      "The Stream cancelation failed with an unexpected error"
    );
  }
}

async function assertWithdrawFailure(
  txSigner: Keypair,
  assetMint: PublicKey,
  streamId: BN,
  recipient: PublicKey,
  amount: BN,
  depositTokenProgram: PublicKey,
  nftTokenProgram: PublicKey,
  expectedError: string
) {
  const withdrawIx = await lockupProgram.methods
    .withdraw(streamId, amount)
    .accounts({
      signer: txSigner.publicKey,
      assetMint,
      recipient,
      depositTokenProgram,
      nftTokenProgram,
    })
    .instruction();

  await tryCatchWithdrawalIx(withdrawIx, txSigner, expectedError);
}

async function assertWithdrawMaxFailure(
  txSigner: Keypair,
  assetMint: PublicKey,
  streamId: BN,
  recipient: PublicKey,
  depositTokenProgram: PublicKey,
  nftTokenProgram: PublicKey,
  expectedError: string
) {
  const withdrawMaxIx = await lockupProgram.methods
    .withdrawMax(streamId)
    .accounts({
      signer: txSigner.publicKey,
      assetMint,
      recipient,
      depositTokenProgram,
      nftTokenProgram,
    })
    .instruction();

  await tryCatchWithdrawalIx(withdrawMaxIx, txSigner, expectedError);
}

async function tryCatchWithdrawalIx(
  withdrawalIx: TxIx,
  txSigner: Keypair,
  expectedError: string
) {
  try {
    await buildSignAndProcessTx(withdrawalIx, txSigner);
    assert.fail("The Stream withdrawal should've failed, but it didn't");
  } catch (error) {
    assert(
      // TODO: Figure out a more robust way of checking the thrown error
      (error as Error).message.includes(expectedError),
      "The Stream withdrawal failed with an unexpected error"
    );
  }
}

async function buildSignAndProcessTx(
  ixs: TxIx | TxIx[],
  signerKeys: Keypair,
  cuLimit?: number
) {
  const tx = await initializeTx(ixs, cuLimit);
  tx.sign(signerKeys);

  const txMeta = await banksClient.processTransaction(tx);
  console.log(
    `Tx has consumed ${txMeta.computeUnitsConsumed.toString()} compute units - and cost ${await banksClient.getFeeForMessage(
      tx.compileMessage()
    )} lamports in tx fees (not including any rent fees)`
  );
}

async function cancelStream(
  streamId: BN,
  assetMint: PublicKey,
  depositTokenProgram: PublicKey
) {
  const cancelStreamIx = await lockupProgram.methods
    .cancel(streamId)
    .accounts({
      sender: senderKeys.publicKey,
      assetMint,
      depositTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(cancelStreamIx, senderKeys);
}

async function cancelStreamAtSpecificTime(
  streamId: BN,
  assetMint: PublicKey,
  timestamp: bigint,
  depositTokenProgram: PublicKey
) {
  await timeTravelForwardTo(timestamp);
  await cancelStream(streamId, assetMint, depositTokenProgram);
}

async function createMintATAsAndStream(
  isStreamCancelable: boolean,
  milestones: StreamMilestones,
  unlockAmounts: UnlockAmounts,
  depositTokenProgram: PublicKey
): Promise<{
  streamData: any;
  senderATA: PublicKey;
  treasuryATA: PublicKey;
  recipient: PublicKey;
  streamNftMint: PublicKey;
  nftTokenProgram: PublicKey;
  recipientStreamNftATA: PublicKey;
  assetMint: PublicKey;
  depositedAmount: BN;
}> {
  const { assetMint, senderATA } = await createTokenAndMintToSender(
    depositTokenProgram,
    unlockAmounts
  );
  const streamId = await deduceCurrentStreamId();

  const recipient = recipientKeys.publicKey;
  const depositedAmount = await getTokenBalanceByATAKey(senderATA);
  const { nftTokenProgram, recipientStreamNftATA, streamNftMint, treasuryATA } =
    await createWithTimestamps({
      senderKeys,
      recipient,
      assetMint,
      expectedStreamId: streamId,
      depositTokenProgram,
      milestones,
      depositedAmount,
      unlockAmounts,
      isCancelable: isStreamCancelable,
    });

  return {
    streamData: await fetchStreamData(streamId),
    senderATA,
    treasuryATA,
    recipient,
    streamNftMint,
    recipientStreamNftATA,
    nftTokenProgram,
    assetMint,
    depositedAmount,
  };
}

async function createStreamAndTestCancelability(
  milestones: StreamMilestones,
  unlockAmounts: UnlockAmounts,
  depositTokenProgram: PublicKey
) {
  const { streamData, senderATA, assetMint, depositedAmount, treasuryATA } =
    await createMintATAsAndStream(
      true,
      milestones,
      unlockAmounts,
      depositTokenProgram
    );

  // Get the initial token balance of the sender
  const senderInitialTokenBalance = await getTokenBalanceByATAKey(senderATA);

  // Get the current timestamp from Bankrun
  const currentTimestamp = (await banksClient.getClock()).unixTimestamp;

  // Default-initialize the expected refunded amount (full refund for Start)
  const expectedRefundedAmount = depositedAmount.sub(
    getStreamedAmountAt(
      Number(currentTimestamp),
      milestones,
      unlockAmounts,
      depositedAmount
    )
  );

  await cancelStream(streamData.id, assetMint, depositTokenProgram);

  // Perform the post-cancellation assertions
  await performPostCancelAssertions(
    streamData.id,
    assetMint,
    depositTokenProgram,
    senderATA,
    treasuryATA,
    depositedAmount,
    senderInitialTokenBalance,
    expectedRefundedAmount
  );
}

async function createStreamAndTestTransferability(
  depositTokenProgram: PublicKey,
  milestones: StreamMilestones,
  unlockAmounts: UnlockAmounts,
  isCancelable: boolean
) {
  const { streamNftMint, recipientStreamNftATA, nftTokenProgram } =
    await createMintATAsAndStream(
      isCancelable,
      milestones,
      unlockAmounts,
      depositTokenProgram
    );

  const { recipientStreamNftATA: thirdPartyStreamNftATA } =
    await transferStreamNft(
      recipientKeys,
      recipientStreamNftATA,
      thirdPartyKeys.publicKey,
      streamNftMint,
      nftTokenProgram
    );

  // Assert that the Stream NFT has been transferred correctly
  const recipientStreamNftBalance = await getTokenBalanceByATAKey(
    recipientStreamNftATA
  );
  assert(
    recipientStreamNftBalance.eq(new BN(0)),
    "The Stream NFT balance of the original owner hasn't changed"
  );

  const thirdPartyStreamNftBalance = await getTokenBalanceByATAKey(
    thirdPartyStreamNftATA
  );
  assert(
    thirdPartyStreamNftBalance.eq(new BN(1)),
    "The Stream NFT balance of the third party is incorrect"
  );
}

async function getLamportsBalanceOf(address: PublicKey): Promise<bigint> {
  return await banksClient.getBalance(address);
}

async function getSOLBalanceOf(address: PublicKey): Promise<bigint> {
  return (await getLamportsBalanceOf(address)) / BigInt(LAMPORTS_PER_SOL);
}

async function performPostCancelAssertions(
  streamId: BN,
  assetMint: PublicKey,
  depositTokenProgram: PublicKey,
  senderATA: PublicKey,
  treasuryATA: PublicKey,
  depositedAmount: BN,
  senderInitialTokenBalance: BN,
  expectedRefundedAmount: BN
) {
  // Derive the recipient's ATA address
  const recipientATA = deriveRecipientATA(assetMint, depositTokenProgram);

  // Assert that the recipient's ATA doesn't exist
  assert(
    !(await accountExists(recipientATA)),
    "Recipient's ATA shouldn't exist"
  );

  // Get the final token balance of the sender
  const senderFinalTokenBalance = await getTokenBalanceByATAKey(senderATA);

  // Assert that the sender's token balance has been changed correctly
  assert(
    senderFinalTokenBalance.eq(
      senderInitialTokenBalance.add(expectedRefundedAmount)
    ),
    "The amount refunded to the sender is incorrect"
  );

  // Assert that the Treasury ATA has been changed correctly
  const treasuryBalance = await getTokenBalanceByATAKey(treasuryATA);

  assert(
    treasuryBalance.eq(depositedAmount.sub(expectedRefundedAmount)),
    "The Treasury's balance is incorrect"
  );

  // Fetch the Stream
  const fetchedStream = await fetchStreamData(streamId);

  // Assert that the Stream state has been updated correctly
  assert(
    fetchedStream.wasCanceled === true && fetchedStream.isCancelable === false,
    "The Stream couldn't be canceled"
  );

  assert(
    fetchedStream.amounts.refunded.eq(expectedRefundedAmount),
    "The Stream's refunded amount is incorrect"
  );

  const expectedWithdrawnAmount = new BN(0);
  assert(
    fetchedStream.amounts.withdrawn.eq(expectedWithdrawnAmount),
    "The Stream's withdrawn amount is incorrect"
  );
}

interface PerformPostCreateAssertionsArgs {
  streamId: BN;
  assetMint: PublicKey;
  depositTokenProgram: PublicKey;
  depositedAmount: BN;
  unlockAmounts: UnlockAmounts;
  milestones: StreamMilestones;
  isCancelable: boolean;
  senderATA: PublicKey;
  treasuryATA: PublicKey;
  recipientStreamNftATA: PublicKey;
  senderInitialTokenBalance: BN;
}

async function performPostCreateAssertions(
  args: PerformPostCreateAssertionsArgs
) {
  const {
    streamId,
    assetMint,
    depositedAmount,
    unlockAmounts,
    milestones,
    isCancelable,
    senderATA,
    treasuryATA,
    recipientStreamNftATA,
    senderInitialTokenBalance,
  } = args;

  // Assert that the Treasury ATA for the assetMint has been created
  assert(await accountExists(treasuryATA), "Treasury ATA hasn't been created");

  // Confirm that the Stream NFT Mint account has been initialized
  const streamNftMint = getStreamNftMintAddress(streamId);
  assert(await accountExists(streamNftMint), "Stream NFT Mint not initialized");

  // Confirm that the StreamData account has been initialized
  assert(
    await accountExists(getStreamDataAddress(streamId)),
    "StreamData not initialized"
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
  assert(
    await accountExists(streamNftMetadata),
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
  assert(
    await accountExists(streamNftMasterEdition),
    "Stream NFT Master Edition not initialized"
  );

  // Confirm that the Recipient's Stream NFT ATA has been initialized
  assert(
    await accountExists(recipientStreamNftATA),
    "Recipient's Stream NFT ATA not initialized"
  );

  // Confirm that 1 NFT has been minted to the Recipient's Stream NFT ATA
  const recipientStreamNftBalance = await getTokenBalanceByATAKey(
    recipientStreamNftATA
  );
  assert(recipientStreamNftBalance.eq(new BN(1)), "Stream NFT not minted");

  //Confirm that the Total Supply of the Stream NFT Mint is 1
  assert(
    (await getMintTotalSupplyOf(streamNftMint)).eq(new BN(1)),
    "The Total Supply of the Stream NFT Mint is incorrect"
  );

  // Get the final token balance of the sender
  const senderFinalTokenBalance = await getTokenBalanceByATAKey(senderATA);

  // Assert that the sender's token balance has changed as expected
  assert(
    senderFinalTokenBalance.eq(senderInitialTokenBalance.sub(depositedAmount)),
    "The amount debited from the sender is incorrect"
  );

  // Assert that the Treasury ATA contains the deposited tokens
  const treasuryBalance = await getTokenBalanceByATAKey(treasuryATA);

  assert(
    treasuryBalance.eq(depositedAmount),
    "Treasury hasn't received the sender's tokens"
  );

  // Fetch the created Stream
  const streamData = await fetchStreamData(streamId);

  // Assert that the state of the created Stream is correct
  assert(
    streamData.id.eq(streamId) &&
      streamData.sender.equals(senderKeys.publicKey) &&
      streamData.assetMint.equals(assetMint) &&
      streamData.isCancelable === isCancelable &&
      streamData.wasCanceled === false,
    "The state of the created Stream is wrong"
  );

  assert(
    streamData.amounts.deposited.eq(depositedAmount) &&
      streamData.amounts.withdrawn.eq(new BN(0)) &&
      streamData.amounts.refunded.eq(new BN(0)) &&
      streamData.amounts.startUnlock.eq(unlockAmounts.startUnlock) &&
      streamData.amounts.cliffUnlock.eq(unlockAmounts.cliffUnlock),
    "The created Stream's amounts are incorrect"
  );

  assert(
    streamData.timestamps.startTime.eq(milestones.startTime) &&
      streamData.timestamps.cliffTime.eq(milestones.cliffTime) &&
      streamData.timestamps.endTime.eq(milestones.endTime),
    "The created Stream's milestones are incorrect"
  );

  // Assert that the NFT Collection Data account has been updated correctly
  const nftCollectionTotalSupply = await getNftCollectionTotalSupply();
  assert(nftCollectionTotalSupply.eq(streamId.add(new BN(1))));
}

async function performPostWithdrawAssertions(
  streamId: BN,
  assetMint: PublicKey,
  depositTokenProgram: PublicKey,
  depositedAmount: BN,
  expectedWithdrawnAmount: BN,
  treasuryATA: PublicKey,
  treasuryInitialLamports: bigint
) {
  // Get the post-withdrawal Lamports balance of the Treasury
  const treasuryFinalLamports = await getLamportsBalanceOf(treasuryAddress);

  // Assert that the Treasury's balance has been credited with the correct amount
  assert(
    treasuryFinalLamports === treasuryInitialLamports + WITHDRAWAL_FEE_LAMPORTS,
    "The Treasury's Lamports balance hasn't been credited correctly"
  );

  // Derive the recipient's ATA address
  const recipientATA = deriveRecipientATA(assetMint, depositTokenProgram);

  // Get the recipient's token balance
  const recipientTokenBalance = await getTokenBalanceByATAKey(recipientATA);

  // Assert that the recipient's token balance has been changed correctly
  assert(
    recipientTokenBalance.eq(expectedWithdrawnAmount),
    "The amount withdrawn to the recipient is incorrect"
  );

  // Assert that the Treasury ATA has been changed correctly
  const treasuryBalance = await getTokenBalanceByATAKey(treasuryATA);

  assert(
    treasuryBalance.eq(depositedAmount.sub(expectedWithdrawnAmount)),
    "The Treasury's balance is incorrect"
  );

  // Assert that the Stream state has been updated correctly
  const fetchedStream = await fetchStreamData(streamId);

  assert(
    fetchedStream.amounts.withdrawn.eq(expectedWithdrawnAmount),
    "The Stream's withdrawn amount is incorrect"
  );
}

async function testStreamCreation(
  depositTokenProgram: PublicKey,
  isCancelable: boolean,
  milestones: StreamMilestones,
  unlockAmounts: UnlockAmounts
) {
  const { assetMint, senderATA } = await createTokenAndMintToSender(
    depositTokenProgram,
    unlockAmounts
  );

  const streamId = await deduceCurrentStreamId();

  // Get the initial token balance of the sender
  const senderInitialTokenBalance = await getTokenBalanceByATAKey(senderATA);

  const depositedAmount = senderInitialTokenBalance;

  const { treasuryATA, recipientStreamNftATA } = await createWithTimestamps({
    senderKeys,
    recipient: recipientKeys.publicKey,
    assetMint,
    expectedStreamId: streamId,
    depositTokenProgram,
    milestones,
    depositedAmount,
    unlockAmounts,
    isCancelable,
  });

  await performPostCreateAssertions({
    streamId,
    assetMint,
    depositTokenProgram,
    depositedAmount,
    unlockAmounts,
    milestones,
    isCancelable,
    senderATA,
    treasuryATA,
    recipientStreamNftATA,
    senderInitialTokenBalance,
  });
}

async function testForFeeCollection(
  noOfPreceedingWithdrawals: number,
  depositTokenProgram: PublicKey
) {
  for (let i = 0; i < noOfPreceedingWithdrawals; i++) {
    // Create a stream - and withdraw from it (generating fees)
    await createStreamAndWithdrawMax(depositTokenProgram);
  }

  const feesRecipient = thirdPartyKeys.publicKey;

  // Get the fees recipient's balance before the fee collection
  const feesRecipientBalanceBefore = await getLamportsBalanceOf(feesRecipient);

  // Get the Treasury's withdrawable balance
  const expectedFeesAmount = await getWithdrawableBalanceOf(treasuryAddress);

  // Collect the fees
  await collectFees(feeCollectorKeys, feesRecipient);

  // Get the fees recipient's balance after the fee collection
  const feesRecipientBalanceAfter = await getLamportsBalanceOf(feesRecipient);

  // Assert that the fee recipient's balance has increased by the correct amount

  console.log(
    `Fees recipient's balance before: ${feesRecipientBalanceBefore.toString()}`
  );
  console.log(
    `Fees recipient's balance after: ${feesRecipientBalanceAfter.toString()}`
  );
  console.log(`Expected fees amount: ${expectedFeesAmount.toString()}`);
  console.log(
    `Fees recipient's balance change: ${(
      feesRecipientBalanceAfter - feesRecipientBalanceBefore
    ).toString()}`
  );

  assert(
    feesRecipientBalanceAfter ==
      feesRecipientBalanceBefore + expectedFeesAmount,
    "The fee collection failed"
  );

  // Assert that the Treasury's balance is no less than the safe rent exempt balance
  const treasuryBalance = await getLamportsBalanceOf(treasuryAddress);
  assert(
    treasuryBalance >= (await getSafeRentExemptBalanceFor(treasuryAddress)),
    "Treasury's balance < safe rent exempt balance"
  );
}

async function collectFees(txSigner: Keypair, feesRecipient: PublicKey) {
  const collectFeesIx = await lockupProgram.methods
    .collectFees()
    .accounts({
      feeCollector: txSigner.publicKey,
      feeRecipient: feesRecipient,
    })
    .instruction();

  await buildSignAndProcessTx(collectFeesIx, txSigner);
}

async function createStreamAndWithdrawMax(depositTokenProgram: PublicKey) {
  // Create the Stream
  const milestones = await getDefaultMilestones(banksClient);
  const { streamData, assetMint, nftTokenProgram } =
    await createMintATAsAndStream(
      true,
      milestones,
      getDefaultUnlockAmounts(),
      depositTokenProgram
    );

  await timeTravelForwardTo(BigInt(milestones.endTime.toString()));

  // Withdraw from the Stream
  await withdrawMax(
    streamData.id,
    recipientKeys,
    recipientKeys.publicKey,
    assetMint,
    depositTokenProgram,
    nftTokenProgram
  );
}

async function createStreamWithdrawMaxAndCollectAllFees(
  depositTokenProgram: PublicKey
) {
  // Create a stream - and withdraw from it (generating fees)
  await createStreamAndWithdrawMax(depositTokenProgram);

  // Collect all the withdrawable fees
  await collectFees(feeCollectorKeys, thirdPartyKeys.publicKey);
}

async function testMultiStreamCreationInOneTx(
  depositTokenProgram: PublicKey,
  isCancelable: boolean,
  milestones: StreamMilestones
) {
  const unlockAmounts = getDefaultUnlockAmounts();
  const { assetMint, senderATA } = await createTokenAndMintToSender(
    depositTokenProgram,
    unlockAmounts
  );

  // Get the initial token balance of the sender
  const senderInitialTokenBalance = await getTokenBalanceByATAKey(senderATA);
  const depositedAmountPerStream = senderInitialTokenBalance.div(new BN(2));

  const ixs: TxIx[] = [];

  // Create two Streams in one transaction
  // Note: due to Solana's 1232-byte tx size limit, we can only create up to 2 Streams in one transaction
  for (let i = 0; i < 2; i++) {
    const createStreamIx = await getCreateWithTimestampsIx({
      senderKeys,
      recipient: recipientKeys.publicKey,
      assetMint,
      expectedStreamId: new BN(i),
      depositTokenProgram,
      milestones,
      depositedAmount: depositedAmountPerStream,
      unlockAmounts,
      isCancelable,
    });

    ixs.push(createStreamIx);
  }

  // Build, sign and process the transaction
  await buildSignAndProcessTx(ixs, senderKeys, 600_000);

  // Get the final token balance of the sender
  const senderFinalTokenBalance = await getTokenBalanceByATAKey(senderATA);

  // Assert that the sender's token balance has changed as expected
  assert(
    senderFinalTokenBalance.eq(new BN(0)),
    "The amount debited from the sender is incorrect"
  );

  // Assert that the Treasury ATA contains the deposited tokens
  const treasuryATA = deriveATAAddress(
    assetMint,
    treasuryAddress,
    depositTokenProgram
  );
  const treasuryBalance = await getTokenBalanceByATAKey(treasuryATA);

  assert(
    treasuryBalance.eq(senderInitialTokenBalance),
    "Treasury hasn't received the sender's tokens"
  );

  for (let i = 0; i < 2; i++) {
    const streamId = new BN(i);

    // Fetch the created Stream
    const streamData = await fetchStreamData(streamId);

    // Assert that the state of the created Stream is correct
    assert(
      streamData.id.eq(streamId) &&
        streamData.sender.equals(senderKeys.publicKey) &&
        streamData.assetMint.equals(assetMint) &&
        streamData.isCancelable === isCancelable &&
        streamData.wasCanceled === false,
      "The state of the created Stream is wrong"
    );

    assert(
      streamData.amounts.deposited.eq(depositedAmountPerStream) &&
        streamData.amounts.withdrawn.eq(new BN(0)) &&
        streamData.amounts.refunded.eq(new BN(0)),
      "The created Stream's amounts are incorrect"
    );

    assert(
      streamData.timestamps.startTime.eq(milestones.startTime) &&
        streamData.timestamps.cliffTime.eq(milestones.cliffTime) &&
        streamData.timestamps.endTime.eq(milestones.endTime),
      "The created Stream's milestones are incorrect"
    );
  }

  // Assert that the NFT Collection Data account has been updated correctly
  assert((await getNftCollectionTotalSupply()).eq(new BN(2)));
}

const WithdrawalSize = {
  ZERO: 0,
  OneToken: 1,
  StartUnlock: 2,
  StartUnlockPlusOne: 3,
  CliffUnlock: 4,
  CliffUnlockPlusOne: 5,
  StartAndCliffUnlocks: 6,
  StartAndCliffUnlocksPlusOne: 7,
  OneThirdOfDeposited: 8,
  HalfOfDeposited: 9,
  EntireDeposit: 10,
  StreamedAmount: 11,
  MAX: 12,
} as const;

type WithdrawalSize = (typeof WithdrawalSize)[keyof typeof WithdrawalSize];

async function testForWithdrawalAfterStreamTransfer(
  withdrawalSize: WithdrawalSize,
  depositTokenProgram: PublicKey
) {
  const milestones = await getDefaultMilestones(banksClient);
  const unlockAmounts = getDefaultUnlockAmounts();

  const {
    assetMint,
    depositedAmount,
    nftTokenProgram,
    recipient,
    recipientStreamNftATA,
    streamData,
    streamNftMint,
  } = await createMintATAsAndStream(
    true,
    milestones,
    unlockAmounts,
    depositTokenProgram
  );

  await timeTravelForwardTo(BigInt(milestones.endTime.toString()));

  await transferStreamNft(
    recipientKeys,
    recipientStreamNftATA,
    thirdPartyKeys.publicKey,
    streamNftMint,
    nftTokenProgram
  );

  if (withdrawalSize === WithdrawalSize.MAX) {
    await assertWithdrawMaxFailure(
      recipientKeys,
      assetMint,
      streamData.id,
      recipient,
      depositTokenProgram,
      nftTokenProgram,
      "custom program error: 0x7d3"
    );

    await withdrawMax(
      streamData.id,
      thirdPartyKeys,
      thirdPartyKeys.publicKey,
      assetMint,
      depositTokenProgram,
      nftTokenProgram
    );

    return;
  }

  const withdrawalAmount = withdrawalSizeToWithdrawalAmount(
    withdrawalSize,
    unlockAmounts,
    depositedAmount
  );

  await assertWithdrawFailure(
    recipientKeys,
    assetMint,
    streamData.id,
    recipient,
    withdrawalAmount,
    depositTokenProgram,
    nftTokenProgram,
    "custom program error: 0x7d3"
  );

  await withdraw(
    streamData.id,
    withdrawalAmount,
    thirdPartyKeys,
    thirdPartyKeys.publicKey,
    assetMint,
    depositTokenProgram,
    nftTokenProgram
  );

  // Derive the third party's ATA address
  const thirdPartyAssetATA = deriveATAAddress(
    assetMint,
    thirdPartyKeys.publicKey,
    depositTokenProgram
  );

  // Get the third party's token balance
  const thirdPartyTokenBalance = await getTokenBalanceByATAKey(
    thirdPartyAssetATA
  );

  // Assert that the third party's token balance has been changed correctly
  const expectedWithdrawnAmount = withdrawalAmount;
  assert(
    thirdPartyTokenBalance.eq(expectedWithdrawnAmount),
    "The amount withdrawn to the recipient is incorrect"
  );

  // Assert that the Stream state has been updated correctly
  const fetchedStream = await fetchStreamData(streamData.id);

  assert(
    fetchedStream.amounts.withdrawn.eq(expectedWithdrawnAmount),
    "The Stream's withdrawn amount is incorrect"
  );
}

const BeforeFeeCollection = {
  DoNothing: 0,
  CreateStream: 1,
  CreateStreamAndWithdrawMax: 2,
  CreateStreamWithdrawMaxAndCollectAllFees: 3,
} as const;

type BeforeFeeCollection =
  (typeof BeforeFeeCollection)[keyof typeof BeforeFeeCollection];

async function testForFailureToCollectFees(
  preCollectionAction: BeforeFeeCollection,
  txSigner: Keypair,
  feesRecipient: PublicKey,
  depositTokenProgram: PublicKey,
  expectedErrorCode: string
) {
  // Perform the pre-collection action
  switch (preCollectionAction) {
    case BeforeFeeCollection.DoNothing:
      break;

    case BeforeFeeCollection.CreateStream:
      await createMintATAsAndStream(
        true,
        await getDefaultMilestones(banksClient),
        getDefaultUnlockAmounts(),
        depositTokenProgram
      );
      break;

    case BeforeFeeCollection.CreateStreamAndWithdrawMax:
      await createStreamAndWithdrawMax(depositTokenProgram);
      break;

    case BeforeFeeCollection.CreateStreamWithdrawMaxAndCollectAllFees:
      await createStreamWithdrawMaxAndCollectAllFees(depositTokenProgram);
      break;
  }

  // Assert the failure to collect the fees
  await assertFeeCollectionFailure(txSigner, feesRecipient, expectedErrorCode);
}

const AssetMintKind = {
  Correct: 0,
  Wrong: 1,
} as const;

type AssetMintKind = (typeof AssetMintKind)[keyof typeof AssetMintKind];

async function testForFailureToWithdraw(
  txSigner: Keypair,
  destination: PublicKey,
  depositTokenProgram: PublicKey,
  milestones: StreamMilestones,
  unlockAmounts: UnlockAmounts,
  withdrawalTime: BN,
  withdrawalSize: WithdrawalSize,
  assetMintKind: AssetMintKind,
  expectedError: string
) {
  const { nftTokenProgram, streamData, assetMint, depositedAmount } =
    await createMintATAsAndStream(
      true,
      milestones,
      unlockAmounts,
      depositTokenProgram
    );

  await timeTravelForwardTo(BigInt(withdrawalTime.toString()));

  let assetMintToUse = assetMint;
  if (assetMintKind === AssetMintKind.Wrong) {
    assetMintToUse = await createMint(
      banksClient,
      txSigner,
      txSigner.publicKey,
      null,
      2,
      Keypair.generate(),
      depositTokenProgram
    );

    // Create a Treasury ATA for the wrong assetMint (so that the Tx doesn't fail because of this)
    await createAssociatedTokenAccount(
      banksClient,
      txSigner,
      assetMintToUse,
      treasuryAddress,
      depositTokenProgram
    );
  }

  if (withdrawalSize === WithdrawalSize.MAX) {
    await assertWithdrawMaxFailure(
      txSigner,
      assetMintToUse,
      streamData.id,
      destination,
      depositTokenProgram,
      nftTokenProgram,
      expectedError
    );
    return;
  }

  const withdrawalAmount = withdrawalSizeToWithdrawalAmount(
    withdrawalSize,
    unlockAmounts,
    depositedAmount
  );

  await assertWithdrawFailure(
    txSigner,
    assetMintToUse,
    streamData.id,
    destination,
    withdrawalAmount,
    depositTokenProgram,
    nftTokenProgram,
    expectedError
  );
}

async function testForWithdrawal(
  txSigner: Keypair,
  destination: PublicKey,
  depositTokenProgram: PublicKey,
  milestones: StreamMilestones,
  unlockAmounts: UnlockAmounts,
  withdrawalTime: BN,
  withdrawalSize: WithdrawalSize | BN
) {
  const {
    streamData,
    assetMint,
    depositedAmount,
    nftTokenProgram,
    treasuryATA,
  } = await createMintATAsAndStream(
    true,
    milestones,
    unlockAmounts,
    depositTokenProgram
  );

  await timeTravelForwardTo(BigInt(withdrawalTime.toString()));

  // Get the pre-withdrawal Lamports balance of the Treasury
  const treasuryInitialLamports = await getLamportsBalanceOf(treasuryAddress);

  // Perform the withdrawal

  let withdrawalAmount: BN;

  if (withdrawalSize === WithdrawalSize.MAX) {
    withdrawalAmount = depositedAmount;
    await withdrawMax(
      streamData.id,
      txSigner,
      destination,
      assetMint,
      depositTokenProgram,
      nftTokenProgram
    );

    // Perform the post-withdrawal assertions
    await performPostWithdrawAssertions(
      streamData.id,
      assetMint,
      depositTokenProgram,
      depositedAmount,
      withdrawalAmount,
      treasuryATA,
      treasuryInitialLamports
    );
    return;
  }

  if (withdrawalSize === WithdrawalSize.StreamedAmount) {
    withdrawalAmount = getStreamedAmountAt(
      withdrawalTime,
      milestones,
      unlockAmounts,
      depositedAmount
    );
  } else if (BN.isBN(withdrawalSize)) {
    // If a specific amount has been passed, use it
    withdrawalAmount = withdrawalSize;
  } else {
    withdrawalAmount = withdrawalSizeToWithdrawalAmount(
      withdrawalSize,
      unlockAmounts,
      depositedAmount
    );
  }

  await withdraw(
    streamData.id,
    withdrawalAmount,
    txSigner,
    destination,
    assetMint,
    depositTokenProgram,
    nftTokenProgram
  );

  // Perform the post-withdrawal assertions
  await performPostWithdrawAssertions(
    streamData.id,
    assetMint,
    depositTokenProgram,
    depositedAmount,
    withdrawalAmount,
    treasuryATA,
    treasuryInitialLamports
  );
}

function withdrawalSizeToWithdrawalAmount(
  withdrawalSize: WithdrawalSize,
  unlockAmounts: UnlockAmounts,
  depositedAmount: BN
): BN {
  switch (withdrawalSize) {
    case WithdrawalSize.ZERO:
      return new BN(0);
    case WithdrawalSize.OneToken:
      return new BN(1);
    case WithdrawalSize.StartUnlock:
      return unlockAmounts.startUnlock;
    case WithdrawalSize.StartUnlockPlusOne:
      return unlockAmounts.startUnlock.add(new BN(1));
    case WithdrawalSize.CliffUnlock:
      return unlockAmounts.cliffUnlock;
    case WithdrawalSize.CliffUnlockPlusOne:
      return unlockAmounts.cliffUnlock.add(new BN(1));
    case WithdrawalSize.StartAndCliffUnlocks:
      return unlockAmounts.startUnlock.add(unlockAmounts.cliffUnlock);
    case WithdrawalSize.StartAndCliffUnlocksPlusOne:
      return unlockAmounts.startUnlock
        .add(unlockAmounts.cliffUnlock)
        .add(new BN(1));
    case WithdrawalSize.OneThirdOfDeposited:
      return depositedAmount.div(new BN(3));
    case WithdrawalSize.HalfOfDeposited:
      return depositedAmount.div(new BN(2));
    case WithdrawalSize.EntireDeposit:
      return depositedAmount;
    default:
      throw new Error("Invalid WithdrawalSize passed in for conversion!");
  }
}

const WithdrawalKind = {
  Withdraw: 0,
  WithdrawMax: 1,
} as const;

type WithdrawalKind = (typeof WithdrawalKind)[keyof typeof WithdrawalKind];

async function testForWithdrawalPostCancelAtHalfTime(
  depositTokenProgram: PublicKey,
  withdrawalKind: WithdrawalKind
) {
  const milestones = await getDefaultMilestones(banksClient);
  const unlockAmounts = getDefaultUnlockAmounts();
  const {
    nftTokenProgram,
    streamData,
    recipient,
    senderATA,
    assetMint,
    depositedAmount,
  } = await createMintATAsAndStream(
    true,
    milestones,
    unlockAmounts,
    depositTokenProgram
  );

  // Get the initial token balance of the sender
  const senderInitialTokenBalance = await getTokenBalanceByATAKey(senderATA);

  const cancelTime = BigInt(
    milestones.startTime.add(milestones.endTime).div(new BN(2)).toString()
  );
  await cancelStreamAtSpecificTime(
    streamData.id,
    assetMint,
    cancelTime,
    depositTokenProgram
  );

  const expectedStreamedAmount = depositedAmount.div(new BN(2));
  const expectedWithdrawnAmount = expectedStreamedAmount;

  await actDependingOnWithdrawalKind(
    withdrawalKind,
    streamData.id,
    expectedWithdrawnAmount,
    recipientKeys,
    recipient,
    assetMint,
    depositTokenProgram,
    nftTokenProgram
  );

  // Derive the recipient's ATA address
  const recipientATA = deriveRecipientATA(assetMint, depositTokenProgram);

  // Get the final token balances of the sender and recipient
  const [senderFinalTokenBalance, recipientFinalTokenBalance] =
    await getTokenBalancesByATAKeys(senderATA, recipientATA);

  const expectedRefundedAmount = depositedAmount.sub(expectedStreamedAmount);
  assert(
    senderFinalTokenBalance.eq(
      senderInitialTokenBalance.add(expectedRefundedAmount)
    ),
    "The amount refunded to the sender is incorrect"
  );

  // Assert that the sender's and recipient's token balances have been changed correctly
  assert(
    recipientFinalTokenBalance.eq(expectedWithdrawnAmount),
    "No withdrawal to the recipient was expected"
  );

  // Assert that the Stream state has been updated correctly
  const fetchedStream = await fetchStreamData(streamData.id);

  assert(
    fetchedStream.wasCanceled === true && fetchedStream.isCancelable === false,
    "The Stream couldn't be canceled"
  );

  assert(
    fetchedStream.amounts.withdrawn.eq(expectedWithdrawnAmount),
    "The Stream's withdrawn amount is incorrect"
  );

  assert(
    fetchedStream.amounts.refunded.eq(expectedRefundedAmount),
    "The Stream's refunded amount is incorrect"
  );
}

async function actDependingOnWithdrawalKind(
  withdrawalKind: WithdrawalKind,
  streamId: BN,
  expectedWithdrawnAmount: BN,
  recipientKeys: Keypair,
  recipient: PublicKey,
  assetMint: PublicKey,
  depositTokenProgram: PublicKey,
  nftTokenProgram: PublicKey
) {
  switch (withdrawalKind) {
    case WithdrawalKind.Withdraw:
      await withdraw(
        streamId,
        expectedWithdrawnAmount,
        recipientKeys,
        recipient,
        assetMint,
        depositTokenProgram,
        nftTokenProgram
      );
      break;

    case WithdrawalKind.WithdrawMax:
      await withdrawMax(
        streamId,
        recipientKeys,
        recipient,
        assetMint,
        depositTokenProgram,
        nftTokenProgram
      );
      break;
  }
}

async function testForWithdrawalPostRenounceAtHalfTime(
  depositTokenProgram: PublicKey,
  withdrawalKind: WithdrawalKind
) {
  const milestones = await getDefaultMilestones(banksClient);
  const unlockAmounts = getDefaultUnlockAmounts();
  const {
    nftTokenProgram,
    streamData,
    recipient,
    senderATA,
    assetMint,
    depositedAmount,
  } = await createMintATAsAndStream(
    true,
    milestones,
    unlockAmounts,
    depositTokenProgram
  );

  // Time travel to half time
  await timeTravelForwardTo(
    BigInt(
      milestones.startTime.add(milestones.endTime).div(new BN(2)).toString()
    )
  );

  await renounceStream(streamData.id, senderKeys);

  const expectedStreamedAmount = depositedAmount.div(new BN(2));
  const expectedWithdrawnAmount = expectedStreamedAmount;

  await actDependingOnWithdrawalKind(
    withdrawalKind,
    streamData.id,
    expectedWithdrawnAmount,
    recipientKeys,
    recipient,
    assetMint,
    depositTokenProgram,
    nftTokenProgram
  );

  // Derive the recipient's ATA address
  const recipientATA = deriveRecipientATA(assetMint, depositTokenProgram);

  // Get the final token balances of the recipient
  const recipientFinalTokenBalance = await getTokenBalanceByATAKey(
    recipientATA
  );

  // Assert that the sender's and recipient's token balances have been changed correctly
  assert(
    recipientFinalTokenBalance.eq(expectedWithdrawnAmount),
    "No withdrawal to the recipient was expected"
  );

  // Assert that the Stream state has been updated correctly
  const fetchedStream = await fetchStreamData(streamData.id);

  assert(
    fetchedStream.isCancelable === false,
    "The Stream cancelability couldn't be renounced"
  );

  assert(
    fetchedStream.amounts.withdrawn.eq(expectedWithdrawnAmount),
    "The Stream's withdrawn amount is incorrect"
  );
}

async function createStreamAndTestRenouncement(
  txSigner: Keypair,
  isCancelable: boolean,
  milestones: StreamMilestones,
  depositTokenProgram: PublicKey
) {
  const { streamData } = await createMintATAsAndStream(
    isCancelable,
    milestones,
    getDefaultUnlockAmounts(),
    depositTokenProgram
  );
  const streamId = streamData.id;

  await renounceStream(streamId, txSigner);

  // Fetch the Stream data
  const fetchedStreamData = await fetchStreamData(streamId);

  assert(
    fetchedStreamData.isCancelable === false,
    "The Stream cancelability couldn't be renounced"
  );
}

async function renounceStream(streamId: BN, txSigner: Keypair) {
  const renounceStreamIx = await lockupProgram.methods
    .renounce(streamId)
    .accounts({
      sender: txSigner.publicKey,
    })
    .instruction();

  await buildSignAndProcessTx(renounceStreamIx, txSigner);
}

async function transferStreamNft(
  sender: Keypair,
  sendersStreamNftATA: PublicKey,
  recipient: PublicKey,
  streamNftMint: PublicKey,
  nftTokenProgram: PublicKey
): Promise<{ recipientStreamNftATA: PublicKey }> {
  // Create a streamNftMint ATA for the recipient
  const recipientStreamNftATA = await createAssociatedTokenAccount(
    banksClient,
    sender,
    streamNftMint,
    recipient,
    nftTokenProgram
  );

  // Transfer the Stream NFT to the recipient's ATA
  const signers: anchor.web3.Signer[] = [];
  await transfer(
    banksClient,
    sender,
    sendersStreamNftATA,
    recipientStreamNftATA,
    sender.publicKey,
    1,
    signers,
    nftTokenProgram
  );

  return { recipientStreamNftATA };
}

async function withdraw(
  streamId: BN,
  withdrawalAmount: BN,
  txSigner: Keypair,
  recipient: PublicKey,
  assetMint: PublicKey,
  depositTokenProgram: PublicKey,
  nftTokenProgram: PublicKey
) {
  const withdrawIx = await lockupProgram.methods
    .withdraw(streamId, withdrawalAmount)
    .accounts({
      signer: txSigner.publicKey,
      recipient,
      assetMint,
      depositTokenProgram,
      nftTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(withdrawIx, txSigner);
}

async function withdrawMax(
  streamId: BN,
  txSigner: Keypair,
  recipient: PublicKey,
  assetMint: PublicKey,
  depositTokenProgram: PublicKey,
  nftTokenProgram: PublicKey
) {
  const withdrawIx = await lockupProgram.methods
    .withdrawMax(streamId)
    .accounts({
      signer: txSigner.publicKey,
      recipient,
      assetMint,
      depositTokenProgram,
      nftTokenProgram,
    })
    .instruction();

  await buildSignAndProcessTx(withdrawIx, txSigner);
}

interface CreateWithTimestampsArgs {
  senderKeys: Keypair;
  recipient: PublicKey;
  assetMint: PublicKey;
  expectedStreamId: BN;
  depositTokenProgram: PublicKey;
  milestones: StreamMilestones;
  depositedAmount: BN;
  unlockAmounts: UnlockAmounts;
  isCancelable: boolean;
}

async function createTokenAndMintToSender(
  depositTokenProgram: PublicKey,
  unlockAmounts: UnlockAmounts
): Promise<{
  assetMint: PublicKey;
  senderATA: PublicKey;
}> {
  const TOKEN_DECIMALS = 9;
  const freezeAuthority = null;

  const assetMint = await createMint(
    banksClient,
    senderKeys,
    senderKeys.publicKey,
    freezeAuthority,
    TOKEN_DECIMALS,
    Keypair.generate(),
    depositTokenProgram
  );
  console.log(`Created Token Mint: ${assetMint}`);

  const senderATA = await createAssociatedTokenAccount(
    banksClient,
    senderKeys,
    assetMint,
    senderKeys.publicKey,
    depositTokenProgram
  );
  console.log(`Sender's ATA: ${senderATA}`);

  // Determine the number of tokens to mint
  const tokenAmount = Number(
    unlockAmounts.startUnlock.add(unlockAmounts.cliffUnlock).add(new BN(1000))
  );

  const signers: anchor.web3.Signer[] = [];
  await mintTo(
    banksClient,
    senderKeys,
    assetMint,
    senderATA,
    senderKeys,
    tokenAmount,
    signers,
    depositTokenProgram
  );
  console.log(`Minted ${tokenAmount} tokens to the Sender ATA`);

  return { assetMint, senderATA };
}

async function createWithTimestamps(args: CreateWithTimestampsArgs): Promise<{
  streamId: BN;
  treasuryATA: PublicKey;
  streamNftMint: PublicKey;
  recipientStreamNftATA: PublicKey;
  nftTokenProgram: PublicKey;
}> {
  const { senderKeys, expectedStreamId } = args;

  const nftTokenProgram = TOKEN_PROGRAM_ID;
  const createStreamIx = await getCreateWithTimestampsIx(args);
  await buildSignAndProcessTx(createStreamIx, senderKeys, 270_000);

  const streamNftMint = getStreamNftMintAddress(expectedStreamId);
  const recipientStreamNftATA = deriveATAAddress(
    streamNftMint,
    recipientKeys.publicKey,
    nftTokenProgram
  );

  const treasuryATA = deriveATAAddress(
    args.assetMint,
    treasuryAddress,
    args.depositTokenProgram
  );

  return {
    streamId: expectedStreamId,
    treasuryATA,
    streamNftMint,
    recipientStreamNftATA,
    nftTokenProgram,
  };
}

async function getCreateWithTimestampsIx(
  args: CreateWithTimestampsArgs
): Promise<TxIx> {
  const {
    senderKeys,
    recipient,
    assetMint,
    expectedStreamId,
    depositTokenProgram,
    milestones,
    depositedAmount,
    unlockAmounts,
    isCancelable,
  } = args;

  return await lockupProgram.methods
    .createWithTimestamps(
      milestones.startTime,
      unlockAmounts.startUnlock,
      milestones.cliffTime,
      unlockAmounts.cliffUnlock,
      milestones.endTime,
      depositedAmount,
      isCancelable
    )
    .accountsPartial({
      sender: senderKeys.publicKey,
      streamNftMint: getStreamNftMintAddress(expectedStreamId),
      assetMint,
      recipient,
      depositTokenProgram,
      nftTokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

function getPDAAddress(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey
): PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function deriveRecipientATA(
  assetMint: PublicKey,
  tokenProgram: PublicKey
): PublicKey {
  return deriveATAAddress(assetMint, recipientKeys.publicKey, tokenProgram);
}

async function deduceCurrentStreamId(): Promise<BN> {
  return getNftCollectionTotalSupply();
}

async function fetchStreamData(streamId: BN): Promise<any> {
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

async function generateAccWithSOL(
  context: ProgramTestContext
): Promise<Keypair> {
  const acc = Keypair.generate();
  const accInfo = getDefaultAccountInfoWithSOL();
  context.setAccount(acc.publicKey, accInfo);

  return acc;
}

async function getAccountDataOf(
  address: PublicKey
): Promise<Uint8Array | undefined> {
  return (await banksClient.getAccount(address))?.data;
}

function getStreamDataAddress(streamId: BN): PublicKey {
  const streamNftMint = getStreamNftMintAddress(streamId);

  // The seeds used when creating the Stream Data
  const streamDataSeeds = [Buffer.from("LL_stream"), streamNftMint.toBuffer()];

  return getPDAAddress(streamDataSeeds, lockupProgramId);
}

function getStreamNftMintAddress(streamId: BN): PublicKey {
  // The seeds used when creating the Stream NFT Mint
  const streamNftMintSeeds = [
    Buffer.from("stream_nft_mint"),
    streamId.toBuffer("le", 8),
  ];
  return getPDAAddress(streamNftMintSeeds, lockupProgramId);
}

async function getTokenBalancesByATAKeys(...atas: PublicKey[]): Promise<BN[]> {
  const balances = await Promise.all(
    atas.map(async (ata) => {
      const balance = await getTokenBalanceByATAKey(ata);
      return balance;
    })
  );
  return balances;
}

async function getTokenBalanceByATAKey(ata: PublicKey): Promise<BN> {
  const ataData = await getAccountDataOf(ata);
  assert.ok(ataData, "ATA data is undefined");

  return new BN(getTokenBalanceByATAAccountData(ataData));
}

async function getMintTotalSupplyOf(mint: PublicKey): Promise<BN> {
  const mintData = await getAccountDataOf(mint);
  assert.ok(mintData, "Mint data is undefined");

  return new BN(getTotalSupplyByAccountData(mintData));
}

async function initializeTx(
  ixs: TxIx | TxIx[],
  cuLimit?: number
): Promise<Transaction> {
  const res = await banksClient.getLatestBlockhash();
  if (!res) throw new Error("Couldn't get the latest blockhash");

  const tx = new Transaction();
  tx.recentBlockhash = res[0];

  if (cuLimit !== undefined) {
    const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: cuLimit,
    });
    tx.add(cuLimitIx);
  }

  const internal_ixs: TxIx[] = Array.isArray(ixs) ? ixs : [ixs];
  internal_ixs.forEach((ix) => tx.add(ix));

  return tx;
}

async function accountExists(address: PublicKey): Promise<boolean> {
  const account = await banksClient.getAccount(address);
  return account != null;
}

async function timeTravelForwardTo(timestamp: bigint) {
  const currentClock = await banksClient.getClock();

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

async function getSafeRentExemptBalanceFor(
  address: PublicKey
): Promise<bigint> {
  return (await getRentExemptBalanceOf(address)) * 2n;
}

async function getRentExemptBalanceOf(address: PublicKey): Promise<bigint> {
  const accInfoBytes = await banksClient.getAccount(address);
  if (!accInfoBytes) {
    throw new Error(
      "Can't calculate rent exempt balance of an undefined account!"
    );
  }

  const clusterRent = await banksClient.getRent();
  const accountDataLength = BigInt(accInfoBytes.data.byteLength);

  return clusterRent.minimumBalance(accountDataLength);
}

async function getWithdrawableBalanceOf(address: PublicKey): Promise<bigint> {
  return (
    (await getLamportsBalanceOf(address)) -
    (await getSafeRentExemptBalanceFor(address))
  );
}

async function getNftCollectionTotalSupply(): Promise<BN> {
  const nftCollectionData = await fetchNftCollectionData(
    nftCollectionDataAddress
  );

  return new BN(nftCollectionData.totalSupply.toString(), 10);
}

async function fetchNftCollectionData(address: PublicKey): Promise<any> {
  const nftCollectionDataAcc = await banksClient.getAccount(address);
  if (!nftCollectionDataAcc) {
    throw new Error("NFT Collection Data account is undefined");
  }

  // Return the NFT Collection Data decoded via the Anchor account layout
  const nftCollectionDataLayout = lockupProgram.account.nftCollectionData;
  return nftCollectionDataLayout.coder.accounts.decode(
    "nftCollectionData",
    Buffer.from(nftCollectionDataAcc.data)
  );
}
