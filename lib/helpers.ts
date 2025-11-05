import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export function getPDAAddress(seeds: Array<Buffer | Uint8Array>, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

export async function sleepFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toBigInt(number: number | BN): bigint {
  return BigInt(number.toString());
}

export function toBn(number: number | bigint): BN {
  return new BN(number.toString());
}
