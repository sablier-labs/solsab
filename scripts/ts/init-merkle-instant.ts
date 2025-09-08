import * as anchor from "@coral-xyz/anchor";
import { type Keypair } from "@solana/web3.js";
import { describe, it } from "vitest";
import { ProgramId, SABLIER_ADMIN } from "../../lib/constants";
import type { SablierMerkleInstant } from "../../target/types/sablier_merkle_instant";

export let anchorProvider: anchor.AnchorProvider;
export let merkleInstantProgram: anchor.Program<SablierMerkleInstant>;
export let signerKeys: Keypair;

describe("Sablier Merkle Instant post-deployment initialization", () => {
  it("Initializes the Sablier Merkle Instant program", async () => {
    await configureTestingEnvironment();
    await initSablierMerkleInstant();
  });
});

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export async function configureTestingEnvironment() {
  anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);

  merkleInstantProgram = anchor.workspace.SablierMerkleInstant as anchor.Program<SablierMerkleInstant>;

  // Initialize the accounts involved in the tests
  signerKeys = (anchorProvider.wallet as anchor.Wallet).payer;
}

export async function initSablierMerkleInstant() {
  await merkleInstantProgram.methods
    .initialize(SABLIER_ADMIN, ProgramId.CHAINLINK_PROGRAM, ProgramId.CHAINLINK_SOL_USD_FEED)
    .signers([signerKeys])
    .accounts({
      initializer: signerKeys.publicKey,
    })
    .rpc();
}
