import * as anchor from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";

import { SablierMerkleInstant } from "../../target/types/sablier_merkle_instant";

let anchorProvider: any;
let merkleInstantProgram: anchor.Program<SablierMerkleInstant>;
let senderKeys: Keypair;

describe("SablierLockup post-deployment initialization", () => {
  beforeEach(async () => {
    await configureTestingEnvironment();
    await initializeSablierMerkleInstant();
  });
});

async function configureTestingEnvironment() {
  anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);

  merkleInstantProgram = anchor.workspace
    .SablierMerkleInstant as anchor.Program<SablierMerkleInstant>;

  // Initialize the accounts involved in the tests
  senderKeys = (anchorProvider.wallet as anchor.Wallet).payer;
}

async function initializeSablierMerkleInstant() {
  await merkleInstantProgram.methods
    .initialize(senderKeys.publicKey)
    .signers([senderKeys])
    .accounts({
      initializer: senderKeys.publicKey,
    })
    .rpc();
}
