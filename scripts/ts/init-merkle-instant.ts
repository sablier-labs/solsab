import * as anchor from "@coral-xyz/anchor";
import type { Keypair } from "@solana/web3.js";
import { beforeEach, describe } from "vitest";

import type { SablierMerkleInstant } from "../../target/types/sablier_merkle_instant";

let anchorProvider: anchor.AnchorProvider;
let merkleInstantProgram: anchor.Program<SablierMerkleInstant>;
let senderKeys: Keypair;

describe("SablierLockup post-deployment initialization", () => {
  beforeEach(async () => {
    await configureTestingEnvironment();
    await initSablierMerkleInstant();
  });
});

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

async function configureTestingEnvironment() {
  anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);

  merkleInstantProgram = anchor.workspace.SablierMerkleInstant as anchor.Program<SablierMerkleInstant>;

  // Initialize the accounts involved in the tests
  senderKeys = (anchorProvider.wallet as anchor.Wallet).payer;
}

async function initSablierMerkleInstant() {
  await merkleInstantProgram.methods
    .initialize(senderKeys.publicKey)
    .signers([senderKeys])
    .accounts({
      initializer: senderKeys.publicKey,
    })
    .rpc();
}
