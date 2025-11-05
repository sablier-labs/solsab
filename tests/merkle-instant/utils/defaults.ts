import { BN } from "@coral-xyz/anchor";
import dayjs from "dayjs";
import { usdc } from "../../../lib/convertors";

export namespace Amount {
  export const AGGREGATE = usdc(10_000);
  export const CLAIM = usdc(100);
  export const CLAWBACK = usdc(1000);
}

export namespace Time {
  // We use this fixed timestamp to ensure that the mock Chainlink data is not outdated.
  export const GENESIS = new BN(1754142441); // August 2, 2025 1:47:21 PM
}

export namespace Campaign {
  export const NAME = "HODL or Nothing";
  export const START_TIME = Time.GENESIS;
  export const EXPIRATION_TIME = new BN(dayjs().add(10, "days").unix());
  export const IPFS_CID = "bafkreiecpwdhvkmw4y6iihfndk7jhwjas3m5htm7nczovt6m37mucwgsrq";
  const GRACE_PERIOD_SECONDS = new BN(7 * 24 * 60 * 60 + 1);
  export const POST_GRACE_PERIOD = Time.GENESIS.add(GRACE_PERIOD_SECONDS);
}

export namespace Seed {
  export const CAMPAIGN = Buffer.from("campaign");
  export const TREASURY = Buffer.from("treasury");
}
