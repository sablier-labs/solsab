import * as anchor from "@coral-xyz/anchor";
import type { Keypair } from "@solana/web3.js";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { ProgramId, SABLIER_ADMIN } from "../../../lib/constants";
import type { SablierMerkleInstant } from "../../../target/types/sablier_merkle_instant";

export let anchorProvider: anchor.AnchorProvider;
export let merkleInstantProgram: anchor.Program<SablierMerkleInstant>;
export let signerKeys: Keypair;

export async function configureTestingEnvironment() {
  anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);

  merkleInstantProgram = anchor.workspace
    .SablierMerkleInstant as anchor.Program<SablierMerkleInstant>;

  // Initialize the accounts involved in the tests
  signerKeys = (anchorProvider.wallet as anchor.Wallet).payer;
}

export async function initSablierMerkleInstant() {
  // Use signer as admin if devnet, otherwise SABLIER_ADMIN
  const admin = anchorProvider.connection.rpcEndpoint.includes("devnet")
    ? signerKeys.publicKey
    : SABLIER_ADMIN;

  // Set a higher compute unit limit so that the transaction doesn't fail
  const increaseCULimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });

  await merkleInstantProgram.methods
    .initialize(admin, ProgramId.CHAINLINK_PROGRAM, ProgramId.CHAINLINK_SOL_USD_FEED)
    .signers([signerKeys])
    .accounts({
      initializer: signerKeys.publicKey,
    })
    .preInstructions([increaseCULimitIx])
    .rpc();
}
