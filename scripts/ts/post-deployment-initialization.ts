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
    const depositTokenMint = await createTokenAndMintToSender();

    // Create 3 unique streams
    await createStream({
      salt: new BN(1),
      depositTokenMint,
      depositAmount: new BN(1_000e9),
      cliffDuration: new BN(0),
      totalDuration: new BN(3600), // 1 hour
      unlockStartAmount: new BN(0),
      unlockCliffAmount: new BN(0),
      isCancelable: true,
    });
    await createStream({
      salt: new BN(2),
      depositTokenMint,
      depositAmount: new BN(10_000e9),
      cliffDuration: new BN(3600), // 1 hour
      totalDuration: new BN(3600 * 3), // 3 hours
      unlockStartAmount: new BN(0),
      unlockCliffAmount: new BN(2000e9),
      isCancelable: true,
    });
    await createStream({
      salt: new BN(3),
      depositTokenMint,
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
  depositTokenMint: PublicKey;
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
    depositTokenMint,
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
      depositTokenMint,
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
      initializer: senderKeys.publicKey,
      nftTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

async function createTokenAndMintToSender(): Promise<PublicKey> {
  const TOKEN_DECIMALS = 9;
  const freezeAuthority = null;

  const depositTokenMint = await createMint(
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
    depositTokenMint,
    senderKeys.publicKey
  );

  const mintedAmount = new BN(100_000e9); // sufficient amount
  await mintTo(
    anchorProvider.connection,
    senderKeys,
    depositTokenMint,
    senderATA.address,
    senderKeys,
    Number(mintedAmount)
  );

  return depositTokenMint;
}
