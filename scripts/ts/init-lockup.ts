import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { type Keypair } from "@solana/web3.js";
import { describe, it } from "vitest";
import { ProgramId } from "../../lib/constants";
import { type SablierLockup } from "../../target/types/sablier_lockup";

export let anchorProvider: anchor.AnchorProvider;
export let lockupProgram: anchor.Program<SablierLockup>;
export let senderKeys: Keypair;

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
  senderKeys = (anchorProvider.wallet as anchor.Wallet).payer;
}

export async function initSablierLockup() {
  await lockupProgram.methods
    .initialize(senderKeys.publicKey, ProgramId.CHAINLINK_PROGRAM, ProgramId.CHAINLINK_SOL_USD_FEED)
    .signers([senderKeys])
    .accounts({
      initializer: senderKeys.publicKey,
      nftTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}
