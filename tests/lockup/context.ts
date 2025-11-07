import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import type { Keypair } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { ProgramId, ZERO } from "../../lib/constants";
import { ProgramName } from "../../lib/enums";
import { getPDAAddress } from "../../lib/helpers";
import IDL from "../../target/idl/sablier_lockup.json";
import type { SablierLockup as SablierLockupProgram } from "../../target/types/sablier_lockup";
import type { NftCollectionData, StreamData } from "../../target/types/sablier_lockup_structs";
import { buildSignAndProcessTx, deriveATAAddress, getATABalance } from "../common/anchor-bankrun";
import { TestContext } from "../common/context";
import type { Treasury, User } from "../common/types";
import { AMOUNTS, Amount, Seed, TIMESTAMPS, Time, UNLOCK_AMOUNTS } from "./utils/defaults";
import type { Salts, Stream } from "./utils/types";

export class LockupTestContext extends TestContext {
  // Programs and addresses
  public nftCollectionDataAddress!: PublicKey;
  public lockup!: anchor.Program<SablierLockupProgram>;

  // Users
  public sender!: User;

  // Stream Salts
  public salts!: Salts;

  async setUpLockup({ initProgram = true } = {}) {
    // Call parent setup with lockup specific programs
    await super.setUp(ProgramName.Lockup, new PublicKey(IDL.address), [
      {
        name: "token_metadata_program",
        programId: ProgramId.TOKEN_METADATA,
      },
    ]);

    // Deploy the program being tested
    this.lockup = new anchor.Program<SablierLockupProgram>(IDL, this.bankrunProvider);

    // Create the sender user
    this.sender = await this.createUser();

    // Compute addresses
    this.nftCollectionDataAddress = getPDAAddress(
      [Seed.NFT_COLLECTION_DATA],
      this.lockup.programId,
    );
    this.treasuryAddress = getPDAAddress([Seed.TREASURY], this.lockup.programId);

    // Set the block time to the genesis time
    await this.timeTravelTo(Time.GENESIS);

    if (initProgram) {
      // Initialize the SablierLockup program
      await this.initializeLockup();

      // Create the default streams
      this.salts = {
        default: await this.createWithTimestampsLl(),
        nonCancelable: await this.createWithTimestampsLl({
          isCancelable: false,
        }),
        nonExisting: new BN(1729),
      };
    }
  }

  /*//////////////////////////////////////////////////////////////////////////
                            STATE-CHANGING INSTRUCTIONS
  //////////////////////////////////////////////////////////////////////////*/

  async cancel({
    salt = this.salts.default,
    signer = this.sender.keys,
    depositedTokenMint = this.usdc,
    depositedTokenProgram = token.TOKEN_PROGRAM_ID,
  } = {}): Promise<void> {
    const streamNftMint = this.getStreamNftMintAddress(salt);
    const cancelStreamIx = await this.lockup.methods
      .cancel()
      .accounts({
        depositedTokenMint,
        depositedTokenProgram,
        sender: signer.publicKey,
        streamNftMint,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, cancelStreamIx, signer);
  }

  async cancelToken2022(salt: BN): Promise<void> {
    await this.cancel({
      depositedTokenMint: this.dai,
      depositedTokenProgram: token.TOKEN_2022_PROGRAM_ID,
      salt,
    });
  }

  async collectFees(signer: Keypair = this.feeCollector.keys) {
    const collectFeesIx = await this.lockup.methods
      .collectFees()
      .accounts({
        feeCollector: signer.publicKey,
        feeRecipient: this.sender.keys.publicKey,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, collectFeesIx, signer);
  }

  async createWithDurationsLl({
    cliffDuration = Time.CLIFF_DURATION,
    salt,
  }: {
    cliffDuration?: BN;
    salt?: BN;
  } = {}): Promise<BN> {
    // Use the total supply as the salt for the stream
    salt = salt ?? (await this.getTotalSupply());

    const createWithDurationsLlIx = await this.lockup.methods
      .createWithDurationsLl(
        salt,
        Amount.DEPOSIT,
        cliffDuration,
        Time.TOTAL_DURATION,
        Amount.START,
        cliffDuration.isZero() ? ZERO : Amount.CLIFF,
        true,
      )
      .accounts({
        creator: this.sender.keys.publicKey,
        depositTokenMint: this.usdc,
        depositTokenProgram: token.TOKEN_PROGRAM_ID,
        nftTokenProgram: token.TOKEN_PROGRAM_ID,
        recipient: this.recipient.keys.publicKey,
        sender: this.sender.keys.publicKey,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, createWithDurationsLlIx, this.sender.keys);

    return salt;
  }

  async createWithTimestampsLl({
    creator = this.sender.keys,
    senderPubKey = this.sender.keys.publicKey,
    recipientPubKey = this.recipient.keys.publicKey,
    depositTokenMint = this.usdc,
    depositTokenProgram = token.TOKEN_PROGRAM_ID,
    timestamps = TIMESTAMPS(),
    depositAmount = Amount.DEPOSIT,
    unlockAmounts = UNLOCK_AMOUNTS(),
    isCancelable = true,
    salt = new BN(-1),
  } = {}): Promise<BN> {
    // Use the total supply as the salt for the stream
    salt = salt.isNeg() ? await this.getTotalSupply() : salt;

    const txIx = await this.lockup.methods
      .createWithTimestampsLl(
        salt,
        depositAmount,
        timestamps.start,
        timestamps.cliff,
        timestamps.end,
        unlockAmounts.start,
        unlockAmounts.cliff,
        isCancelable,
      )
      .accounts({
        creator: creator.publicKey,
        depositTokenMint,
        depositTokenProgram,
        nftTokenProgram: token.TOKEN_PROGRAM_ID,
        recipient: recipientPubKey,
        sender: senderPubKey,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, txIx, this.sender.keys);

    return salt;
  }

  async createWithTimestampsLlToken2022(): Promise<BN> {
    return await this.createWithTimestampsLl({
      depositTokenMint: this.dai,
      depositTokenProgram: token.TOKEN_2022_PROGRAM_ID,
    });
  }

  async initializeLockup(): Promise<void> {
    const initializeIx = await this.lockup.methods
      .initialize(
        this.feeCollector.keys.publicKey,
        ProgramId.CHAINLINK_PROGRAM,
        ProgramId.CHAINLINK_SOL_USD_FEED,
      )
      .accounts({
        initializer: this.sender.keys.publicKey,
        nftTokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, initializeIx, this.sender.keys);
  }

  async renounce({ salt = this.salts.default, signer = this.sender.keys } = {}): Promise<void> {
    const streamNftMint = this.getStreamNftMintAddress(salt);
    const renounceIx = await this.lockup.methods
      .renounce()
      .accounts({
        sender: signer.publicKey,
        streamNftMint,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, renounceIx, signer);
  }

  async withdraw({
    salt = this.salts.default,
    withdrawAmount = Amount.WITHDRAW,
    signer = this.recipient.keys,
    withdrawalRecipient = this.recipient.keys.publicKey,
    depositedTokenMint = this.usdc,
    depositedTokenProgram = token.TOKEN_PROGRAM_ID,
  } = {}): Promise<void> {
    const streamNftMint = this.getStreamNftMintAddress(salt);
    const withdrawIx = await this.lockup.methods
      .withdraw(withdrawAmount)
      .accounts({
        chainlinkProgram: ProgramId.CHAINLINK_PROGRAM,
        chainlinkSolUsdFeed: ProgramId.CHAINLINK_SOL_USD_FEED,
        depositedTokenMint,
        depositedTokenProgram,
        nftTokenProgram: token.TOKEN_PROGRAM_ID,
        signer: signer.publicKey,
        streamNftMint,
        streamRecipient: this.recipient.keys.publicKey,
        withdrawalRecipient,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, withdrawIx, signer);
  }

  async withdrawToken2022(salt: BN, signer: Keypair): Promise<void> {
    await this.withdraw({
      depositedTokenMint: this.dai,
      depositedTokenProgram: token.TOKEN_2022_PROGRAM_ID,
      salt,
      signer,
    });
  }

  async withdrawMax({
    salt = this.salts.default,
    signer = this.sender.keys.publicKey,
    withdrawalRecipient = this.recipient.keys.publicKey,
    depositedTokenMint = this.usdc,
    depositedTokenProgram = token.TOKEN_PROGRAM_ID,
  } = {}): Promise<void> {
    const streamNftMint = this.getStreamNftMintAddress(salt);

    const withdrawMaxIx = await this.lockup.methods
      .withdrawMax()
      .accounts({
        chainlinkProgram: ProgramId.CHAINLINK_PROGRAM,
        chainlinkSolUsdFeed: ProgramId.CHAINLINK_SOL_USD_FEED,
        depositedTokenMint,
        depositedTokenProgram,
        nftTokenProgram: token.TOKEN_PROGRAM_ID,
        signer,
        streamNftMint,
        streamRecipient: this.recipient.keys.publicKey,
        withdrawalRecipient,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, withdrawMaxIx, this.sender.keys);
  }

  /*//////////////////////////////////////////////////////////////////////////
                               READ-ONLY INSTRUCTIONS
  //////////////////////////////////////////////////////////////////////////*/

  async refundableAmountOf(salt: BN = this.salts.default): Promise<BN> {
    return await this.lockup.methods
      .refundableAmountOf()
      .accounts({
        streamNftMint: this.getStreamNftMintAddress(salt),
      })
      .signers([this.defaultBankrunPayer])
      .view();
  }

  async statusOf(salt = this.salts.default): Promise<string> {
    const result = await this.lockup.methods
      .statusOf()
      .accounts({
        streamNftMint: this.getStreamNftMintAddress(salt),
      })
      .signers([this.defaultBankrunPayer])
      .view();

    // Extract the key from the enum object
    return Object.keys(result)[0];
  }

  async streamExists(salt = this.salts.default): Promise<boolean> {
    return await this.lockup.methods
      .streamExists(this.sender.keys.publicKey, salt)
      .accounts({})
      .signers([this.defaultBankrunPayer])
      .view();
  }

  async streamedAmountOf(salt = this.salts.default): Promise<BN> {
    return await this.lockup.methods
      .streamedAmountOf()
      .accounts({
        streamNftMint: this.getStreamNftMintAddress(salt),
      })
      .signers([this.defaultBankrunPayer])
      .view();
  }

  async treasuryView(): Promise<Treasury> {
    return await this.lockup.methods
      .treasuryView()
      .accounts({})
      .signers([this.defaultBankrunPayer])
      .view();
  }

  async withdrawableAmountOf(salt = this.salts.default): Promise<BN> {
    return await this.lockup.methods
      .withdrawableAmountOf()
      .accounts({
        streamNftMint: this.getStreamNftMintAddress(salt),
      })
      .signers([this.defaultBankrunPayer])
      .view();
  }

  async withdrawalFeeInLamports(): Promise<BN> {
    return await this.lockup.methods
      .withdrawalFeeInLamports()
      .accounts({
        chainlinkProgram: ProgramId.CHAINLINK_PROGRAM,
        chainlinkSolUsdFeed: ProgramId.CHAINLINK_SOL_USD_FEED,
      })
      .signers([this.defaultBankrunPayer])
      .view();
  }

  /*//////////////////////////////////////////////////////////////////////////
                                   HELPERS
  //////////////////////////////////////////////////////////////////////////*/

  async getSenderLamports(): Promise<BN> {
    return await this.getLamportsOf(this.sender.keys.publicKey);
  }

  async getTreasuryLamports(): Promise<BN> {
    return await this.getLamportsOf(this.treasuryAddress);
  }

  defaultStream({
    salt = this.salts.default,
    depositedTokenMint = this.usdc,
    tokenProgram = ProgramId.TOKEN,
    isCancelable = true,
    isDepleted = false,
    wasCanceled = false,
  } = {}): Stream {
    const data: StreamData = {
      amounts: AMOUNTS(),
      bump: 0,
      depositedTokenMint,
      isCancelable,
      isDepleted,
      salt,
      sender: this.sender.keys.publicKey,
      timestamps: TIMESTAMPS(),
      wasCanceled,
    };
    const streamDataAddress = this.getStreamDataAddress(salt);
    const streamDataAta = deriveATAAddress(depositedTokenMint, streamDataAddress, tokenProgram);
    const streamNftMint = this.getStreamNftMintAddress(salt);
    const recipientStreamNftAta = deriveATAAddress(
      streamNftMint,
      this.recipient.keys.publicKey,
      ProgramId.TOKEN,
    );
    const streamNftMetadata = getPDAAddress(
      [Seed.METADATA, ProgramId.TOKEN_METADATA.toBuffer(), streamNftMint.toBuffer()],
      ProgramId.TOKEN_METADATA,
    );
    const streamNftMasterEdition = getPDAAddress(
      [Seed.METADATA, ProgramId.TOKEN_METADATA.toBuffer(), streamNftMint.toBuffer(), Seed.EDITION],
      ProgramId.TOKEN_METADATA,
    );

    // Return the Stream object
    return {
      data,
      dataAddress: streamDataAddress,
      dataAta: streamDataAta,
      nftMasterEdition: streamNftMasterEdition,
      nftMetadataAddress: streamNftMetadata,
      nftMintAddress: streamNftMint,
      recipientStreamNftAta: recipientStreamNftAta,
    };
  }

  defaultStreamToken2022({
    salt = this.salts.default,
    isCancelable = true,
    isDepleted = false,
    wasCanceled = false,
  } = {}): Stream {
    return this.defaultStream({
      depositedTokenMint: this.dai,
      isCancelable,
      isDepleted,
      salt,
      tokenProgram: ProgramId.TOKEN_2022,
      wasCanceled,
    });
  }

  async fetchStreamData(salt = this.salts.default): Promise<StreamData> {
    const streamDataAddress = this.getStreamDataAddress(salt);
    const streamDataAcc = await this.banksClient.getAccount(streamDataAddress);
    if (!streamDataAcc) {
      throw new Error("Stream Data account is undefined");
    }

    // Return the Stream data decoded via the Anchor account layout
    const streamLayout = this.lockup.account.streamData;

    return streamLayout.coder.accounts.decode<StreamData>(
      "streamData",
      Buffer.from(streamDataAcc.data),
    );
  }

  async getSenderTokenBalance(tokenMint = this.usdc): Promise<BN> {
    const senderAta = tokenMint === this.usdc ? this.sender.usdcATA : this.sender.daiATA;
    return await getATABalance(this.banksClient, senderAta);
  }

  /*//////////////////////////////////////////////////////////////////////////
                                PRIVATE METHODS
  //////////////////////////////////////////////////////////////////////////*/

  private getStreamDataAddress(salt: BN): PublicKey {
    const streamNftMint = this.getStreamNftMintAddress(salt);
    const streamDataSeeds = [Seed.STREAM_DATA, streamNftMint.toBuffer()];
    return getPDAAddress(streamDataSeeds, this.lockup.programId);
  }

  private getStreamNftMintAddress(
    salt: BN,
    signer: PublicKey = this.sender.keys.publicKey,
  ): PublicKey {
    // The seeds used when creating the Stream NFT Mint
    const streamNftMintSeeds = [Seed.STREAM_NFT_MINT, signer.toBuffer(), salt.toBuffer("le", 16)];

    return getPDAAddress(streamNftMintSeeds, this.lockup.programId);
  }

  private async getTotalSupply(): Promise<BN> {
    const nftCollectionDataAcc = await this.banksClient.getAccount(this.nftCollectionDataAddress);

    if (!nftCollectionDataAcc) {
      throw new Error("NFT Collection Data account is undefined");
    }

    // Get the NFT Collection Data
    const nftCollectionData =
      this.lockup.account.nftCollectionData.coder.accounts.decode<NftCollectionData>(
        "nftCollectionData",
        Buffer.from(nftCollectionDataAcc.data),
      );

    return nftCollectionData.totalSupply;
  }
}
