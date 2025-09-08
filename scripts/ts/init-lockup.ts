import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { type Keypair } from "@solana/web3.js";
import { describe, it } from "vitest";
import { ProgramId, SABLIER_ADMIN } from "../../lib/constants";
import { type SablierLockup } from "../../target/types/sablier_lockup";

export let anchorProvider: anchor.AnchorProvider;
export let lockupProgram: anchor.Program<SablierLockup>;
export let signerKeys: Keypair;

describe("Sablier Lockup post-deployment initialization", () => {
  it("Initializes the Sablier Lockup program", async () => {
    await configureTestingEnvironment();
    await initSablierLockup();
  });
});

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export async function configureTestingEnvironment() {
  anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);
  lockupProgram = anchor.workspace.SablierLockup as anchor.Program<SablierLockup>;
  // Initialize the accounts involved in the tests
  signerKeys = (anchorProvider.wallet as anchor.Wallet).payer;
}

export async function initSablierLockup() {
  await lockupProgram.methods
    .initialize(SABLIER_ADMIN, ProgramId.CHAINLINK_PROGRAM, ProgramId.CHAINLINK_SOL_USD_FEED)
    .signers([signerKeys])
    .accounts({
      initializer: signerKeys.publicKey,
      nftTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}
