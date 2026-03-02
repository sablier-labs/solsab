import type { BN } from "@coral-xyz/anchor";
import type { AddedAccount } from "solana-bankrun";
import mockAccount from "../../lib/chainlink_sol_usd_feed_mock.json";
import { ProgramId } from "../../lib/constants";
import { toBn } from "../../lib/helpers";

/// TODO: add multiple mocks scenarios to match the EVM ones:
/// https://github.com/sablier-labs/evm-utils/blob/9a4139fed83788c5ffb455193f5005abf02ea366/src/mocks/ChainlinkMocks.sol
export class ChainlinkMock {
  /// To get the mock data run the CLI: `solana account 99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR --url devnet --output json`
  /// This data is mocked at "1754142441" Unix timestamp
  private readonly mockBuffer = Buffer.from(mockAccount.account.data[0], "base64");

  async accountData(): Promise<AddedAccount> {
    return {
      address: ProgramId.CHAINLINK_SOL_USD_FEED,
      info: {
        data: new Uint8Array(this.mockBuffer),
        executable: mockAccount.account.executable,
        lamports: mockAccount.account.lamports,
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
   * Reads the timestamp from the mock Chainlink data.
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
