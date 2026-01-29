import type { BN } from "@coral-xyz/anchor";
import type { AddedAccount } from "solana-bankrun";
import { ProgramId } from "../../lib/constants";
import { toBn } from "../../lib/helpers";

/// TODO: add multiple mocks scenarios to match the EVM ones:
/// https://github.com/sablier-labs/evm-utils/blob/9a4139fed83788c5ffb455193f5005abf02ea366/src/mocks/ChainlinkMocks.sol
export class ChainlinkMock {
  /// To get the mock data run the CLI: `solana account 99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR --url devnet --output json`
  /// This data is mocked at "1754142441" Unix timestamp
  public MOCK_CHAINLINK_DATA =
    "YLNFQoCBSXUCAWQUUYa2ANnUYYrbqZcNlEBTsnm1vMbAD/Shxwnxadi/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AAD9IzGmE6swmiVX6E+mpeINgNJ4h4AyDGib6NC7wlNPTCAvIFVTRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAr+bMBAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD7PsAXAAAAAOkWjmgAAAAAoTdp0wMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  private readonly mockBuffer = Buffer.from(this.MOCK_CHAINLINK_DATA, "base64");

  async accountData(): Promise<AddedAccount> {
    const MOCK_ACCOUNT_DATA = new Uint8Array(this.mockBuffer);

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

    return feeUSD.mul(toBn(10).pow(toBn(1 + decimals))).div(price);
  }

  /**
   * Reads the i128 price from the mock Chainlink data.
   * Chainlink's Round.answer is i128 (16 bytes, little-endian) at offset 216.
   */
  public getMockPrice(): BN {
    // Read i128 as two u64s (little-endian) and combine
    const low = this.mockBuffer.readBigUInt64LE(216);
    const high = this.mockBuffer.readBigInt64LE(224);
    const fullPrice = low + (high << 64n);
    return toBn(fullPrice);
  }

  /**
   * Reads the timestamp from {@link MOCK_CHAINLINK_DATA}.
   * Parses the u64 at offset 208 (Chainlink's Round.timestamp) and returns it
   * as a {@link BN} via {@link toBn}.
   */
  public getMockTimestamp(): BN {
    return toBn(this.mockBuffer.readBigUInt64LE(208));
  }

  /**
   * Reads the decimals from the mock Chainlink data.
   * Chainlink decimals is u8 at offset 138.
   */
  public getMockDecimals(): number {
    return this.mockBuffer[138];
  }
}
