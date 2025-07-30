import BN from "bn.js";
import dayjs from "dayjs";
import { usdc } from "../../../lib/convertors";

export namespace Amount {
  export const AGGREGATE = usdc(10_000);
  export const CLAIM_FEE_USD = new BN(2);
  export const CLAIM = usdc(100);
  export const CLAWBACK = usdc(1000);
}

export namespace Time {
  export const GENESIS_DAY = dayjs(); // today
  export const GENESIS = new BN(GENESIS_DAY.unix());
}

export namespace Campaign {
  export const CAMPAIGN_NAME = "HODL or Nothing";
  export const EXPIRATION = new BN(dayjs().add(10, "days").unix());
  export const IPFS_CID = "bafkreiecpwdhvkmw4y6iihfndk7jhwjas3m5htm7nczovt6m37mucwgsrq";
  export const POST_GRACE_PERIOD = new BN(Time.GENESIS_DAY.add(7, "days").add(1, "second").unix());
}

export namespace Seed {
  export const CAMPAIGN = Buffer.from("campaign");
  export const TREASURY = Buffer.from("treasury");
}
