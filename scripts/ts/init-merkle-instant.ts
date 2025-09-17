import { describe, it } from "vitest";
import { configureTestingEnvironment, initSablierMerkleInstant } from "./common/init-merkle-instant-base";

describe("Sablier Merkle Instant post-deployment initialization", () => {
  it("Initializes the Sablier Merkle Instant program", async () => {
    await configureTestingEnvironment();
    await initSablierMerkleInstant();
  });
});
