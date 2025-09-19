import { describe, it } from "vitest";
import { configureTestingEnvironment, initSablierLockup } from "./common/init-lockup-base";

describe("Sablier Lockup post-deployment initialization", () => {
  it("Initializes the Sablier Lockup program", async () => {
    await configureTestingEnvironment();
    await initSablierLockup();
  });
});
