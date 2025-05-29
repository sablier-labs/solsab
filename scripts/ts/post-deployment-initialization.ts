import { PublicKey, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";

import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { SablierLockup } from "../../target/types/sablier_lockup";

let anchorProvider: any;
let senderKeys: Keypair;
let lockupProgram: anchor.Program<SablierLockup>;

describe("SablierLockup post-deployment initialization", () => {
  beforeEach(async () => {
    await configureTestingEnvironment();
    await initializeSablierLockup();
  });

  it("Creates 3 different SPL Token LL Streams", async () => {
    // Create a token mint and mint some tokens to the sender
    const assetMint = await createTokenAndMintToSender();

    // Create 3 unique streams
    await createStream({
      salt: new BN(1),
      assetMint,
      depositAmount: new BN(1_000e9),
      cliffDuration: new BN(0),
      totalDuration: new BN(3600), // 1 hour
      unlockStartAmount: new BN(0),
      unlockCliffAmount: new BN(0),
      isCancelable: true,
    });
    await createStream({
      salt: new BN(2),
      assetMint,
      depositAmount: new BN(10_000e9),
      cliffDuration: new BN(3600), // 1 hour
      totalDuration: new BN(3600 * 3), // 3 hours
      unlockStartAmount: new BN(0),
      unlockCliffAmount: new BN(2000e9),
      isCancelable: true,
    });
    await createStream({
      salt: new BN(3),
      assetMint,
      depositAmount: new BN(30_000e9),
      cliffDuration: new BN(3600 * 24), // 1 day
      totalDuration: new BN(3 * 3600 * 24), // 3 days
      unlockStartAmount: new BN(2000e9),
      unlockCliffAmount: new BN(10_000e9),
      isCancelable: false,
    });
  });
});

// HELPER FUNCTIONS AND DATA STRUCTS

interface CreateParams {
  salt: BN;
  assetMint: PublicKey;
  depositAmount: BN;
  cliffDuration: BN;
  totalDuration: BN;
  unlockStartAmount: BN;
  unlockCliffAmount: BN;
  isCancelable: boolean;
}

async function createStream(params: CreateParams) {
  const {
    salt,
    assetMint,
    depositAmount,
    cliffDuration,
    totalDuration,
    unlockStartAmount,
    unlockCliffAmount,
    isCancelable,
  } = params;

  const increaseCULimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000,
  });

  await lockupProgram.methods
    .createWithDurations(
      salt,
      depositAmount,
      cliffDuration,
      totalDuration,
      unlockStartAmount,
      unlockCliffAmount,
      isCancelable
    )
    .accounts({
      sender: senderKeys.publicKey,
      assetMint,
      recipient: senderKeys.publicKey,
      nftTokenProgram: TOKEN_PROGRAM_ID,
      depositTokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions([increaseCULimitIx])
    .rpc();
}

async function configureTestingEnvironment() {
  anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);
  lockupProgram = anchor.workspace
    .SablierLockup as anchor.Program<SablierLockup>;

  // Initialize the accounts involved in the tests
  senderKeys = (anchorProvider.wallet as anchor.Wallet).payer;
}

async function initializeSablierLockup() {
  await lockupProgram.methods
    .initialize(senderKeys.publicKey)
    .signers([senderKeys])
    .accounts({
      deployer: senderKeys.publicKey,
      nftTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

async function createTokenAndMintToSender(): Promise<PublicKey> {
  const TOKEN_DECIMALS = 9;
  const freezeAuthority = null;

  const assetMint = await createMint(
    anchorProvider.connection,
    senderKeys,
    senderKeys.publicKey,
    freezeAuthority,
    TOKEN_DECIMALS,
    Keypair.generate()
  );

  const senderATA = await getOrCreateAssociatedTokenAccount(
    anchorProvider.connection,
    senderKeys,
    assetMint,
    senderKeys.publicKey
  );

  const mintedAmount = new BN(100_000e9); // sufficient amount
  await mintTo(
    anchorProvider.connection,
    senderKeys,
    assetMint,
    senderATA.address,
    senderKeys,
    Number(mintedAmount)
  );

  return assetMint;
}
