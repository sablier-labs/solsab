import type { BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { ProgramId, ZERO } from "../../lib/constants";
import { ProgramName } from "../../lib/enums";
import { getPDAAddress } from "../../lib/helpers";
import IDL from "../../target/idl/sablier_merkle_instant.json";
import type { SablierMerkleInstant as SablierMerkleInstantProgram } from "../../target/types/sablier_merkle_instant";
import type { Campaign as CampaignData } from "../../target/types/sablier_merkle_instant_structs";
import { buildSignAndProcessTx, deriveATAAddress, transfer } from "../common/anchor-bankrun";
import { TestContext } from "../common/context";
import type { Treasury, User } from "../common/types";
import { Amount, Campaign, Seed, Time } from "./utils/defaults";
import type { LeafData } from "./utils/merkle";
import { getProof, getRoot } from "./utils/merkle";

export class MerkleInstantTestContext extends TestContext {
  // Programs and addresses
  public merkleInstant!: anchor.Program<SablierMerkleInstantProgram>;

  // Users
  public campaignCreator!: User;
  public clawbackRecipient!: User;

  // Campaigns
  public defaultCampaign!: PublicKey;
  public defaultCampaignToken2022!: PublicKey;

  /** For the recipient declared in the base TestContext */
  public readonly defaultIndex = 0;
  private defaultMerkleProof!: number[][];

  // Merkle Tree
  private leaves!: LeafData[];
  private merkleRoot!: number[];
  private recipient1!: PublicKey;
  private recipient2!: PublicKey;
  private recipient3!: PublicKey;

  async setUpMerkleInstant({ initProgram = true } = {}): Promise<void> {
    // Call parent setup with merkle-instant specific programs
    await super.setUp(ProgramName.MerkleInstant, new PublicKey(IDL.address));

    // Deploy the program being tested
    this.merkleInstant = new anchor.Program<SablierMerkleInstantProgram>(IDL, this.bankrunProvider);

    // Create the Campaign Creator user
    this.campaignCreator = await this.createUser();

    // Create the Default Clawback Recipient user
    this.clawbackRecipient = await this.createUser();

    // Pre-calculate the address of the Treasury
    this.treasuryAddress = getPDAAddress([Seed.TREASURY], this.merkleInstant.programId);

    // Create the recipients to be included in the Merkle Tree
    this.recipient1 = (await this.createUser()).keys.publicKey;
    this.recipient2 = (await this.createUser()).keys.publicKey;
    this.recipient3 = (await this.createUser()).keys.publicKey;

    // Declare the leaves of the Merkle Tree before hashing and sorting
    this.leaves = [
      {
        amount: Amount.CLAIM,
        index: this.defaultIndex,
        // Use the default recipient's public key for the first leaf
        recipient: this.recipient.keys.publicKey,
      },
      { amount: Amount.CLAIM, index: 1, recipient: this.recipient1 },
      { amount: Amount.CLAIM, index: 2, recipient: this.recipient2 },
      { amount: Amount.CLAIM, index: 3, recipient: this.recipient3 },
    ];

    this.merkleRoot = getRoot(this.leaves);
    this.defaultMerkleProof = getProof(this.leaves, this.leaves[0]);

    // Set the block time to the genesis time.
    await this.timeTravelTo(Time.GENESIS);

    if (initProgram) {
      // Initialize the Merkle Instant program
      await this.initializeMerkleInstant();

      // Create the default campaigns
      this.defaultCampaign = await this.createCampaign();
      this.defaultCampaignToken2022 = await this.createCampaign({
        airdropTokenMint: this.dai,
        airdropTokenProgram: ProgramId.TOKEN_2022,
      });
    }
  }

  /*//////////////////////////////////////////////////////////////////////////
                            STATE-CHANGING INSTRUCTIONS
  //////////////////////////////////////////////////////////////////////////*/

  async claim({
    campaign = this.defaultCampaign,
    claimerKeys = this.recipient.keys,
    amount = Amount.CLAIM,
    recipientAddress = this.recipient.keys.publicKey,
    airdropTokenMint = this.usdc,
    airdropTokenProgram = ProgramId.TOKEN,
  } = {}): Promise<void> {
    const txIx = await this.merkleInstant.methods
      .claim(this.defaultIndex, amount, this.defaultMerkleProof)
      .accounts({
        airdropTokenMint,
        airdropTokenProgram,
        campaign: campaign,
        chainlinkProgram: ProgramId.CHAINLINK_PROGRAM,
        chainlinkSolUsdFeed: ProgramId.CHAINLINK_SOL_USD_FEED,
        claimer: claimerKeys.publicKey,
        recipient: recipientAddress,
      })
      .instruction();

    // Build and sign the transaction
    await buildSignAndProcessTx(this.banksClient, txIx, claimerKeys);
  }

  async claimFeeInLamports(): Promise<BN> {
    return await this.merkleInstant.methods
      .claimFeeInLamports()
      .accounts({
        chainlinkProgram: ProgramId.CHAINLINK_PROGRAM,
        chainlinkSolUsdFeed: ProgramId.CHAINLINK_SOL_USD_FEED,
      })
      .signers([this.defaultBankrunPayer])
      .view();
  }

  async clawback({
    signer = this.campaignCreator.keys,
    campaign = this.defaultCampaign,
    amount = Amount.CLAWBACK,
    clawbackRecipient = this.clawbackRecipient.keys.publicKey,
    airdropTokenMint = this.usdc,
    airdropTokenProgram = ProgramId.TOKEN,
  } = {}): Promise<void> {
    const txIx = await this.merkleInstant.methods
      .clawback(amount)
      .accounts({
        airdropTokenMint,
        airdropTokenProgram,
        campaign,
        campaignCreator: signer.publicKey,
        clawbackRecipient,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, txIx, signer);
  }

  async collectFees({
    signer = this.feeCollector.keys,
    feeRecipient = this.recipient.keys.publicKey,
  } = {}): Promise<void> {
    const txIx = await this.merkleInstant.methods
      .collectFees()
      .accounts({
        feeCollector: signer.publicKey,
        feeRecipient,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, txIx, signer);
  }

  async createCampaign({
    creator = this.campaignCreator,
    name = Campaign.NAME,
    campaignFunder = this.campaignCreator.keys,
    startTime = Campaign.START_TIME,
    expirationTime = Campaign.EXPIRATION_TIME,
    airdropTokenMint = this.usdc,
    airdropTokenProgram = ProgramId.TOKEN,
  } = {}): Promise<PublicKey> {
    // Derive the address of the campaign
    const campaign = getPDAAddress(
      [
        Seed.CAMPAIGN,
        creator.keys.publicKey.toBuffer(),
        Buffer.from(this.merkleRoot),
        startTime.toArrayLike(Buffer, "le", 8),
        expirationTime.toArrayLike(Buffer, "le", 8),
        Buffer.from(name),
        airdropTokenMint.toBuffer(),
      ],
      this.merkleInstant.programId,
    );

    const txIx = await this.merkleInstant.methods
      .createCampaign(
        this.merkleRoot,
        startTime,
        expirationTime,
        name,
        Campaign.IPFS_CID,
        Amount.AGGREGATE,
        this.leaves.length,
      )
      .accounts({
        airdropTokenMint,
        airdropTokenProgram,
        creator: creator.keys.publicKey,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, txIx, creator.keys);

    const campaignAta = deriveATAAddress(airdropTokenMint, campaign, airdropTokenProgram);

    const campaignFunderAta = deriveATAAddress(airdropTokenMint, campaignFunder.publicKey, airdropTokenProgram);

    // Transfer the aggregate amount from the campaign funder to the campaign
    await transfer(
      this.banksClient,
      campaignFunder,
      campaignFunderAta,
      campaignAta,
      campaignFunder.publicKey,
      Amount.AGGREGATE,
      [],
      airdropTokenProgram,
    );

    return campaign;
  }

  async initializeMerkleInstant(): Promise<void> {
    const initializeIx = await this.merkleInstant.methods
      .initialize(this.feeCollector.keys.publicKey, ProgramId.CHAINLINK_PROGRAM, ProgramId.CHAINLINK_SOL_USD_FEED)
      .accounts({
        initializer: this.campaignCreator.keys.publicKey,
      })
      .instruction();

    await buildSignAndProcessTx(this.banksClient, initializeIx, this.campaignCreator.keys);
  }

  /*//////////////////////////////////////////////////////////////////////////
                               READ-ONLY INSTRUCTIONS
  //////////////////////////////////////////////////////////////////////////*/

  async treasuryView(): Promise<Treasury> {
    return await this.merkleInstant.methods.treasuryView().accounts({}).signers([this.defaultBankrunPayer]).view();
  }

  /*//////////////////////////////////////////////////////////////////////////
                                   HELPERS
  //////////////////////////////////////////////////////////////////////////*/

  defaultCampaignData(): CampaignData {
    return {
      airdropTokenMint: this.usdc,
      bump: 0,
      campaignStartTime: Campaign.START_TIME,
      creator: this.campaignCreator.keys.publicKey,
      expirationTime: Campaign.EXPIRATION_TIME,
      firstClaimTime: ZERO,
      ipfsCid: Campaign.IPFS_CID,
      merkleRoot: Array.from(this.merkleRoot),
      name: Campaign.NAME,
    };
  }

  async getTreasuryLamports(): Promise<BN> {
    return await this.getLamportsOf(this.treasuryAddress);
  }

  async fetchCampaignData(campaign = this.defaultCampaign): Promise<CampaignData> {
    return await this.merkleInstant.account.campaign.fetch(campaign);
  }
}
