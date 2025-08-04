import * as anchor from "@coral-xyz/anchor";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ComputeBudgetProgram, Keypair, type PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { beforeEach, describe, it } from "vitest";
import { BN_1, Decimals, ProgramId, ZERO } from "../../lib/constants";
import { sol } from "../../lib/convertors";
import { type SablierLockup } from "../../target/types/sablier_lockup";

let anchorProvider: anchor.AnchorProvider;
let lockupProgram: anchor.Program<SablierLockup>;
let senderKeys: Keypair;

describe("SablierLockup post-deployment initialization", () => {
  beforeEach(async () => {
    await configureTestingEnvironment();
    await initSablierLockup();
  });

  it("Creates three different SPL Token LL Streams", async () => {
    // Create a token mint and mint some tokens to the sender
    const depositTokenMint = await createTokenAndMintToSender();

    // Create 3 unique streams
    await createStream({
      cliffDuration: ZERO,
      depositAmount: sol(1000),
      depositTokenMint,
      isCancelable: true,
      salt: BN_1,
      totalDuration: new BN(3600), // 1 hour
      unlockCliffAmount: ZERO,
      unlockStartAmount: ZERO,
    });
    await createStream({
      cliffDuration: new BN(3600), // 1 hour
      depositAmount: sol(10_000),
      depositTokenMint,
      isCancelable: true,
      salt: new BN(2),
      totalDuration: new BN(3600 * 3), // 3 hours
      unlockCliffAmount: sol(2000),
      unlockStartAmount: new BN(0),
    });
    await createStream({
      cliffDuration: new BN(3600 * 24), // 1 day
      depositAmount: sol(30_000),
      depositTokenMint,
      isCancelable: false,
      salt: new BN(3),
      totalDuration: new BN(3 * 3600 * 24), // 3 days
      unlockCliffAmount: sol(10_000),
      unlockStartAmount: sol(2000),
    });
  });
});

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

type CreateParams = {
  cliffDuration: BN;
  depositAmount: BN;
  depositTokenMint: PublicKey;
  isCancelable: boolean;
  salt: BN;
  totalDuration: BN;
  unlockStartAmount: BN;
  unlockCliffAmount: BN;
};

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
    .createWithDurationsLl(
      salt,
      depositAmount,
      cliffDuration,
      totalDuration,
      unlockStartAmount,
      unlockCliffAmount,
      isCancelable,
    )
    .accounts({
      depositTokenMint,
      depositTokenProgram: TOKEN_PROGRAM_ID,
      nftTokenProgram: TOKEN_PROGRAM_ID,
      recipient: senderKeys.publicKey,
      sender: senderKeys.publicKey,
    })
    .preInstructions([increaseCULimitIx])
    .rpc();
}

async function configureTestingEnvironment() {
  anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);
  lockupProgram = anchor.workspace.SablierLockup as anchor.Program<SablierLockup>;
  // Initialize the accounts involved in the tests
  senderKeys = (anchorProvider.wallet as anchor.Wallet).payer;
}

async function initSablierLockup() {
  await lockupProgram.methods
    .initialize(senderKeys.publicKey, ProgramId.CHAINLINK_PROGRAM, ProgramId.CHAINLINK_SOL_USD_FEED)
    .signers([senderKeys])
    .accounts({
      initializer: senderKeys.publicKey,
      nftTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

async function createTokenAndMintToSender(): Promise<PublicKey> {
  const freezeAuthority = null;

  const depositTokenMint = await createMint(
    anchorProvider.connection,
    senderKeys,
    senderKeys.publicKey,
    freezeAuthority,
    Decimals.SOL,
    Keypair.generate(),
  );

  const senderATA = await getOrCreateAssociatedTokenAccount(
    anchorProvider.connection,
    senderKeys,
    depositTokenMint,
    senderKeys.publicKey,
  );

  const mintedAmount = sol(1_000_000);
  await mintTo(
    anchorProvider.connection,
    senderKeys,
    depositTokenMint,
    senderATA.address,
    senderKeys,
    Number(mintedAmount),
  );

  return depositTokenMint;
}
