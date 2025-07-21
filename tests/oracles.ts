import fetch from "node-fetch";
import { get, isNil } from "lodash-es";

export async function getFeeInLamports(fee: number): Promise<number> {
  const solUsdPrice = await getSolUsdPrice();
  if (solUsdPrice <= 0) {
    throw new Error("Invalid SOL price");
  }

  const NO_LAMPORTS_IN_1_SOL = 1_000_000_000; // 1 SOL = 1 billion lamports
  // Transform the fee from USD to Lamports, truncating the sub-lamport amount
  return Math.floor((fee * NO_LAMPORTS_IN_1_SOL) / solUsdPrice);
}

async function getSolUsdPrice(): Promise<number> {
  try {
    return await fetchSolUsdPriceHermes();
  } catch {
    try {
      return await fetchSolUsdPriceCoingecko();
    } catch (error) {
      console.error("Failed to fetch SOL price:", error);
      return 0;
    }
  }
}

async function fetchSolUsdPriceCoingecko(): Promise<number> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
  );
  if (!response.ok) throw new Error("Failed to fetch SOL price from Coingecko");

  const json = (await response.json()) as { solana: { usd: number } };

  // Return the price, truncating the sub-dollar digits
  return Math.floor(json.solana.usd);
}

async function fetchSolUsdPriceHermes(): Promise<number> {
  const SOL_USD_FEED_ID =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

  const response = await fetch(
    `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SOL_USD_FEED_ID}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch SOL price from Hermes`);
  }

  const json = await response.json();

  // Safely extract the price or throw if the path does not exist
  const priceData = get(json, "parsed.0.price.price");

  if (isNil(priceData) || priceData === "") {
    throw new Error(`Missing price result for SOL price from Hermes`);
  }

  // Convert the price to a number, considering 8 decimals & truncating the sub-dollar digits
  return Math.floor(priceData / 10 ** 8);
}
