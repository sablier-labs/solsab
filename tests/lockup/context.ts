import * as anchor from "@coral-xyz/anchor";
import type { AssetV1, CollectionV1 } from "@metaplex-foundation/mpl-core";
import { deserializeAssetV1, deserializeCollectionV1 } from "@metaplex-foundation/mpl-core";
import type { RpcAccount, SolAmount } from "@metaplex-foundation/umi";
import { publicKey } from "@metaplex-foundation/umi";
import * as token from "@solana/spl-token";
import type { Keypair } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import type { AccountInfoBytes } from "solana-bankrun";
import { ProgramId, ZERO } from "../../lib/constants";
import { ProgramName } from "../../lib/enums";
import { getPDAAddress } from "../../lib/helpers";
import IDL from "../../target/idl/sablier_lockup.json";
import type { SablierLockup as SablierLockupProgram } from "../../target/types/sablier_lockup";
import type { StreamData } from "../../target/types/sablier_lockup_structs";
import { buildSignAndProcessTx, deriveATAAddress, getATABalance } from "../common/anchor-bankrun";
import { TestContext } from "../common/context";
import type { Treasury, User } from "../common/types";
import {
  Amount,
  LINEAR_AMOUNTS,
  LINEAR_MODEL,
  LINEAR_TIMESTAMPS,
  Seed,
  Time,
  UNLOCK_AMOUNTS,
} from "./utils/defaults";
import type { Salts, Stream } from "./utils/types";

export class LockupTestContext extends TestContext {
  // Programs and addresses
  public nftCollectionAddress!: PublicKey;
  public lockup!: anchor.Program<SablierLockupProgram>;

  // Users
  public sender!: User;

  // Stream Salts
  public salts!: Salts;

  async setUpLockup({ initProgram = true } = {}) {
    // Call parent setup with lockup specific programs
    await super.setUp(ProgramName.Lockup, new PublicKey(IDL.address), [
      {
        name: "mpl_core_program",
        programId: ProgramId.MPL_CORE,
      },
    ]);

    // Deploy the program being tested
    this.lockup = new anchor.Program<SablierLockupProgram>(IDL, this.bankrunProvider);

    // Create the sender user
    this.sender = await this.createUser();

    // Compute addresses
    this.nftCollectionAddress = getPDAAddress([Seed.STREAM_NFT_COLLECTION], this.lockup.programId);
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
    const streamNft = this.getStreamNftAddress(salt);
    const cancelStreamIx = await this.lockup.methods
      .cancel()
      .accounts({
        depositedTokenMint,
        depositedTokenProgram,
        sender: signer.publicKey,
        streamNft,
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
    salt = salt ?? (await this.getStreamNftCollectionSize());

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
        depositTokenMint: this.usdc,
        depositTokenProgram: token.TOKEN_PROGRAM_ID,
        funder: this.sender.keys.publicKey,
        recipient: this.recipient.keys.publicKey,
        sender: this.sender.keys.publicKey,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, createWithDurationsLlIx, this.sender.keys);

    return salt;
  }

  async createWithTimestampsLl({
    funder = this.sender.keys,
    senderPubKey = this.sender.keys.publicKey,
    recipientPubKey = this.recipient.keys.publicKey,
    depositTokenMint = this.usdc,
    depositTokenProgram = token.TOKEN_PROGRAM_ID,
    timestamps = LINEAR_TIMESTAMPS(),
    depositAmount = Amount.DEPOSIT,
    unlockAmounts = UNLOCK_AMOUNTS(),
    isCancelable = true,
    salt = new BN(-1),
  } = {}): Promise<BN> {
    // Use the total supply as the salt for the stream
    salt = salt.isNeg() ? await this.getStreamNftCollectionSize() : salt;

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
        depositTokenMint,
        depositTokenProgram,
        funder: funder.publicKey,
        recipient: recipientPubKey,
        sender: senderPubKey,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, txIx, funder);

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
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, initializeIx, this.sender.keys);
  }

  async renounce({
    salt = this.salts.default,
    signer = this.sender.keys,
    sender = this.sender.keys.publicKey,
  } = {}): Promise<void> {
    const streamNftAddress = this.getStreamNftAddress(salt, sender);

    const renounceIx = await this.lockup.methods
      .renounce()
      .accounts({
        sender: signer.publicKey,
        streamNft: streamNftAddress,
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
    const streamNft = this.getStreamNftAddress(salt);
    const withdrawIx = await this.lockup.methods
      .withdraw(withdrawAmount)
      .accounts({
        chainlinkProgram: ProgramId.CHAINLINK_PROGRAM,
        chainlinkSolUsdFeed: ProgramId.CHAINLINK_SOL_USD_FEED,
        depositedTokenMint,
        depositedTokenProgram,
        signer: signer.publicKey,
        streamNft,
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
    const streamNft = this.getStreamNftAddress(salt);

    const withdrawMaxIx = await this.lockup.methods
      .withdrawMax()
      .accounts({
        chainlinkProgram: ProgramId.CHAINLINK_PROGRAM,
        chainlinkSolUsdFeed: ProgramId.CHAINLINK_SOL_USD_FEED,
        depositedTokenMint,
        depositedTokenProgram,
        signer,
        streamNft,
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
        streamNft: this.getStreamNftAddress(salt),
      })
      .signers([this.defaultBankrunPayer])
      .view();
  }

  async statusOf(salt = this.salts.default): Promise<string> {
    const result = await this.lockup.methods
      .statusOf()
      .accounts({
        streamNft: this.getStreamNftAddress(salt),
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
        streamNft: this.getStreamNftAddress(salt),
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
        streamNft: this.getStreamNftAddress(salt),
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
      amounts: LINEAR_AMOUNTS(),
      bump: 0,
      depositedTokenMint,
      isCancelable,
      isDepleted,
      model: LINEAR_MODEL(),
      salt,
      sender: this.sender.keys.publicKey,
      wasCanceled,
    };
    const streamDataAddress = this.getStreamDataAddress(salt);
    const streamDataAta = deriveATAAddress(depositedTokenMint, streamDataAddress, tokenProgram);
    const nftAddress = this.getStreamNftAddress(salt);
    const collectionAddress = this.getStreamNftCollectionAddress();

    // Return the Stream object
    return {
      data,
      dataAddress: streamDataAddress,
      dataAta: streamDataAta,
      nftAddress,
      nftCollectionAddress: collectionAddress,
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

  async fetchStreamNft(salt = this.salts.default): Promise<AssetV1> {
    const streamNftAddress = this.getStreamNftAddress(salt);
    const streamNftAcc = await this.fetchAccount(streamNftAddress, "Stream NFT");

    const rpcAccount = this.toRpcAccount(streamNftAcc, streamNftAddress);
    return deserializeAssetV1(rpcAccount);
  }

  async fetchStreamNftCollection(): Promise<CollectionV1> {
    const collectionAddress = this.getStreamNftCollectionAddress();
    const nftCollectionAcc = await this.fetchAccount(collectionAddress, "NFT Collection");

    const rpcAccount = this.toRpcAccount(nftCollectionAcc, collectionAddress);
    return deserializeCollectionV1(rpcAccount);
  }

  async getSenderTokenBalance(tokenMint = this.usdc): Promise<BN> {
    const senderAta = tokenMint === this.usdc ? this.sender.usdcATA : this.sender.daiATA;
    return await getATABalance(this.banksClient, senderAta);
  }

  getStreamNftCollectionAddress(): PublicKey {
    // The seeds used when creating the Stream NFT collection
    const collectionSeeds = [Seed.STREAM_NFT_COLLECTION];

    return getPDAAddress(collectionSeeds, this.lockup.programId);
  }

  async getStreamNftCollectionSize(): Promise<BN> {
    const nftCollection = await this.fetchStreamNftCollection();
    return new BN(nftCollection.numMinted);
  }

  /*//////////////////////////////////////////////////////////////////////////
                                PRIVATE METHODS
  //////////////////////////////////////////////////////////////////////////*/

  private async fetchAccount(
    address: PublicKey,
    accountName: string = "Account",
  ): Promise<AccountInfoBytes> {
    const account = await this.banksClient.getAccount(address);
    if (!account) {
      throw new Error(`${accountName} account is undefined`);
    }

    return account;
  }

  private getStreamDataAddress(salt: BN): PublicKey {
    const streamNftAddress = this.getStreamNftAddress(salt);
    const streamDataSeeds = [Seed.STREAM_DATA, streamNftAddress.toBuffer()];
    return getPDAAddress(streamDataSeeds, this.lockup.programId);
  }

  private getStreamNftAddress(salt: BN, sender: PublicKey = this.sender.keys.publicKey): PublicKey {
    // The seeds used when creating the Stream NFT
    const streamNftSeeds = [Seed.STREAM_NFT, sender.toBuffer(), salt.toBuffer("le", 16)];

    return getPDAAddress(streamNftSeeds, this.lockup.programId);
  }

  private toRpcAccount(accInfo: AccountInfoBytes, accAddress: PublicKey): RpcAccount {
    return {
      data: accInfo.data,
      executable: accInfo.executable,
      lamports: accInfo.lamports as unknown as SolAmount,
      owner: publicKey(accInfo.owner.toString()),
      publicKey: publicKey(accAddress.toString()),
    };
  }
}
