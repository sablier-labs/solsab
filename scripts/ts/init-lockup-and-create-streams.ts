import type { BN } from "@coral-xyz/anchor";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import { describe, it } from "vitest";
import { BN_1, Decimals, ZERO } from "../../lib/constants";
import { sol } from "../../lib/convertors";
import { toBn } from "../../lib/helpers";
import {
  anchorProvider,
  configureTestingEnvironment,
  initSablierLockup,
  lockupProgram,
  signerKeys,
} from "./common/init-lockup-base";

describe("Sablier Lockup post-deployment initialization with streams", () => {
  it("Creates three different SPL Token LL Streams", async () => {
    // First initialize the program
    await configureTestingEnvironment();
    await initSablierLockup();

    // Create a token mint and mint some tokens to the sender
    const depositTokenMint = await createTokenAndMintToSender();

    // Create 3 unique streams
    await createStream({
      cliffDuration: ZERO,
      depositAmount: sol(1000),
      depositTokenMint,
      isCancelable: true,
      salt: BN_1,
      totalDuration: toBn(3600), // 1 hour
      unlockCliffAmount: ZERO,
      unlockStartAmount: ZERO,
    });
    await createStream({
      cliffDuration: toBn(3600), // 1 hour
      depositAmount: sol(10_000),
      depositTokenMint,
      isCancelable: true,
      salt: toBn(2),
      totalDuration: toBn(3600 * 3), // 3 hours
      unlockCliffAmount: sol(2000),
      unlockStartAmount: toBn(0),
    });
    await createStream({
      cliffDuration: toBn(3600 * 24), // 1 day
      depositAmount: sol(30_000),
      depositTokenMint,
      isCancelable: false,
      salt: toBn(3),
      totalDuration: toBn(3 * 3600 * 24), // 3 days
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

  // Set a higher compute unit limit so that the transaction doesn't fail
  const increaseCULimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });

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
      recipient: signerKeys.publicKey,
      sender: signerKeys.publicKey,
    })
    .preInstructions([increaseCULimitIx])
    .rpc();
}

async function createTokenAndMintToSender(): Promise<PublicKey> {
  const freezeAuthority = null;

  const depositTokenMint = await createMint(
    anchorProvider.connection,
    signerKeys,
    signerKeys.publicKey,
    freezeAuthority,
    Decimals.SOL,
    Keypair.generate(),
  );

  const signerATA = await getOrCreateAssociatedTokenAccount(
    anchorProvider.connection,
    signerKeys,
    depositTokenMint,
    signerKeys.publicKey,
  );

  const mintedAmount = sol(1_000_000);
  await mintTo(
    anchorProvider.connection,
    signerKeys,
    depositTokenMint,
    signerATA.address,
    signerKeys,
    Number(mintedAmount),
  );

  return depositTokenMint;
}
