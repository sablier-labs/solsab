import { PublicKey } from "@solana/web3.js";
import { describe, it } from "vitest";
import { ProgramId } from "../../lib/constants";
import { toBn } from "../../lib/helpers";
import {
  configureTestingEnvironment,
  initSablierMerkleInstant,
  merkleInstantProgram,
  signerKeys,
} from "./init-merkle-instant";

describe("Sablier Merkle Instant post-deployment initialization with campaign", () => {
  it("should create a campaign", async () => {
    // First initialize the program
    await configureTestingEnvironment();
    await initSablierMerkleInstant();

    await createCampaign();
  });
});

const Campaign = {
  EXPIRATION_TIME: toBn(Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60), // 10 days from now
  IPFS_CID: "bafkreiecpwdhvkmw4y6iihfndk7jhwjas3m5htm7nczovt6m37mucwgsrq",
  MERKLE_ROOT: Array.from(Buffer.from("d52549cb072a1fcd052412fc80f678effe92aeeedccd1cae632c5c6e1de89379", "hex")),
  NAME: "HODL or Nothing",
  START_TIME: toBn(1754142441), // August 2, 2025 1:47:21 PM
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

async function createCampaign({
  creator = signerKeys,
  name = Campaign.NAME,
  startTime = Campaign.START_TIME,
  expirationTime = Campaign.EXPIRATION_TIME,
  airdropTokenMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), // USDC on Devnet
  airdropTokenProgram = ProgramId.TOKEN,
} = {}) {
  await merkleInstantProgram.methods
    .createCampaign(Campaign.MERKLE_ROOT, startTime, expirationTime, name, Campaign.IPFS_CID, toBn(10_000), 100)
    .signers([signerKeys])
    .accounts({
      airdropTokenMint,
      airdropTokenProgram,
      creator: creator.publicKey,
    })
    .rpc();
}
