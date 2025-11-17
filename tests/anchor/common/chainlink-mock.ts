import type BN from "bn.js";
import type { AddedAccount } from "solana-bankrun";
import { ProgramId } from "../../../lib/constants";
import { toBn } from "../../../lib/helpers";

/// TODO: add multiple mocks scenarios to match the EVM ones:
/// https://github.com/sablier-labs/evm-utils/blob/9a4139fed83788c5ffb455193f5005abf02ea366/src/mocks/ChainlinkMocks.sol
export class ChainlinkMock {
  /// To get the mock data run the CLI: `solana account 99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR --url devnet --output json`
  /// This data is mocked at "1754142441" Unix timestamp
  public MOCK_CHAINLINK_DATA =
    "YLNFQoCBSXUCAWQUUYa2ANnUYYrbqZcNlEBTsnm1vMbAD/Shxwnxadi/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AAD9IzGmE6swmiVX6E+mpeINgNJ4h4AyDGib6NC7wlNPTCAvIFVTRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAr+bMBAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD7PsAXAAAAAOkWjmgAAAAAoTdp0wMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

  async accountData(): Promise<AddedAccount> {
    const MOCK_ACCOUNT_DATA = new Uint8Array(Buffer.from(this.MOCK_CHAINLINK_DATA, "base64"));

    return {
      address: ProgramId.CHAINLINK_SOL_USD_FEED,
      info: {
        data: MOCK_ACCOUNT_DATA,
        executable: false,
        lamports: 2616962,
        owner: ProgramId.CHAINLINK_PROGRAM,
      },
    };
  }

  public calculateFeeInLamports(feeUSD: BN): BN {
    const price = this.getMockPrice();
    const decimals = this.getMockDecimals();

    return feeUSD.mul(toBn(10).pow(toBn(1 + decimals))).div(toBn(price));
  }

  // TODO: Fix this, I think it's incorrect
  public getMockPrice(): number {
    const bytes = new Uint8Array(Buffer.from(this.MOCK_CHAINLINK_DATA, "base64"));
    // Price at offset 216 (4 bytes, little-endian, unsigned)
    const priceRaw = (bytes[216] | (bytes[217] << 8) | (bytes[218] << 16) | (bytes[219] << 24)) >>> 0;
    return priceRaw;
  }

  public getMockTimestamp(): number {
    const bytes = new Uint8Array(Buffer.from(this.MOCK_CHAINLINK_DATA, "base64"));
    // Timestamp at offset 208 (4 bytes, little-endian)
    return bytes[208] | (bytes[209] << 8) | (bytes[210] << 16) | (bytes[211] << 24);
  }

  public getMockDecimals(): number {
    const bytes = new Uint8Array(Buffer.from(this.MOCK_CHAINLINK_DATA, "base64"));
    // Decimals at offset 138
    return bytes[138];
  }
}
