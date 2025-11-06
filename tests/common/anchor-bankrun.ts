import type { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import type { Blockhash, PublicKey, Signer, TransactionInstruction as TxIx } from "@solana/web3.js";
import { ComputeBudgetProgram, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import type { BanksClient, BanksTransactionMeta } from "solana-bankrun";
import { toBigInt, toBn } from "../../lib/helpers";

/**
 * Type alias for Transaction compatible with solana-bankrun's processTransaction.
 * Required due to solana-bankrun bundling its own @solana/web3.js (v1.68.0) while
 * the project uses a newer @solana/web3.js version, causing TypeScript type incompatibility.
 * The types are structurally compatible at runtime.
 */
// biome-ignore lint/suspicious/noExplicitAny: Type mismatch between project's @solana/web3.js and solana-bankrun's nested version
type BankrunCompatibleTransaction = any;

export async function buildSignAndProcessTx(
  banksClient: BanksClient,
  ixs: TxIx | TxIx[],
  signerKeys: Keypair | Keypair[],
  cuLimit: number = 1_400_000, // The maximum Compute Unit limit for a tx
) {
  // Get the latest blockhash
  // Initialize the transaction
  const tx = new Transaction();
  tx.recentBlockhash = await getLatestBlockhash(banksClient);

  // Add compute unit limit instruction if specified
  if (cuLimit !== undefined) {
    const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: cuLimit,
    });
    tx.add(cuLimitIx);
  }

  // Add instructions to the transaction
  const internal_ixs: TxIx[] = Array.isArray(ixs) ? ixs : [ixs];
  internal_ixs.forEach((ix) => {
    tx.add(ix);
  });

  // Ensure `signerKeys` is always an array
  const signers = Array.isArray(signerKeys) ? signerKeys : [signerKeys];

  // Sign the transaction with all provided signers
  tx.sign(...signers);

  // Process the transaction
  const txMeta = await banksClient.processTransaction(tx as BankrunCompatibleTransaction);
  return txMeta;
}

export async function createMint(
  banksClient: BanksClient,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  mintKeypair = Keypair.generate(),
  programId = token.TOKEN_PROGRAM_ID,
): Promise<PublicKey> {
  const rent = await banksClient.getRent();

  const mint = mintKeypair.publicKey;
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      lamports: Number(rent.minimumBalance(toBigInt(token.MINT_SIZE))),
      newAccountPubkey: mint,
      programId,
      space: token.MINT_SIZE,
    }),

    token.createInitializeMint2Instruction(
      mint,
      decimals,
      mintAuthority,
      freezeAuthority,
      programId,
    ),
  );
  tx.recentBlockhash = await getLatestBlockhash(banksClient);
  tx.sign(payer, mintKeypair);

  await banksClient.processTransaction(tx as BankrunCompatibleTransaction);
  return mint;
}

export async function createATA(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey,
): Promise<PublicKey> {
  const ata = deriveATAAddress(mint, owner, programId);

  const tx = new Transaction().add(
    token.createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, mint, programId),
  );

  tx.recentBlockhash = await getLatestBlockhash(banksClient);
  tx.sign(payer);

  await banksClient.processTransaction(tx as BankrunCompatibleTransaction);

  return ata;
}

export async function createATAAndFund(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  amount: BN,
  tokenProgram: PublicKey,
  user: PublicKey,
): Promise<PublicKey> {
  // Create ATA for the user
  const userATA = await createATA(banksClient, payer, mint, user, tokenProgram);

  // Mint the amount to the user's ATA
  await mintTo(banksClient, payer, mint, userATA, payer.publicKey, amount, [], tokenProgram);

  return userATA;
}

export function deriveATAAddress(
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey,
): PublicKey {
  const allowOwnerOffCurve = true;
  return token.getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve, programId);
}

export async function getATABalanceMint(
  banksClient: BanksClient,
  owner: PublicKey,
  mint: PublicKey,
): Promise<BN> {
  const mintAccount = await banksClient.getAccount(mint);
  if (!mintAccount) {
    throw new Error("Mint account does not exist!");
  }

  // Derive the ATA address from owner and mint
  const allowOwnerOffCurve = true;
  const ataAddress = await token.getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    mintAccount.owner,
  );

  // Get the ATA account data
  const ataAccount = await banksClient.getAccount(ataAddress);
  if (!ataAccount) {
    throw new Error("The queried ATA account does not exist!");
  }

  const accountData = token.AccountLayout.decode(ataAccount.data);
  return toBn(accountData.amount);
}

export async function getATABalance(banksClient: BanksClient, ataAddress: PublicKey): Promise<BN> {
  const ataAccount = await banksClient.getAccount(ataAddress);
  if (!ataAccount) {
    throw new Error("The queried ATA account does not exist!");
  }

  const accountData = token.AccountLayout.decode(ataAccount.data);
  return toBn(accountData.amount);
}

export async function getMintTotalSupplyOf(
  banksClient: BanksClient,
  mintAddress: PublicKey,
): Promise<BN> {
  const mintAccount = await banksClient.getAccount(mintAddress);
  if (!mintAccount) {
    throw new Error("The queried mint account does not exist!");
  }

  const mintData = token.MintLayout.decode(mintAccount.data);
  return toBn(mintData.supply);
}

export async function transfer(
  banksClient: BanksClient,
  payer: Signer,
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: BN,
  multiSigners: Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID,
): Promise<BanksTransactionMeta> {
  const tx = new Transaction().add(
    token.createTransferInstruction(
      source,
      destination,
      owner,
      toBigInt(amount),
      multiSigners,
      programId,
    ),
  );
  tx.recentBlockhash = await getLatestBlockhash(banksClient);
  tx.sign(payer, ...multiSigners);

  return await banksClient.processTransaction(tx as BankrunCompatibleTransaction);
}

export async function transferLamports(
  banksClient: BanksClient,
  payer: Signer,
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  lamports: number | bigint,
): Promise<BanksTransactionMeta> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      lamports,
      toPubkey,
    }),
  );

  tx.recentBlockhash = await getLatestBlockhash(banksClient);
  tx.sign(payer);

  return await banksClient.processTransaction(tx as BankrunCompatibleTransaction);
}

/* -------------------------------------------------------------------------- */
/*                               INTERNAL LOGIC                               */
/* -------------------------------------------------------------------------- */

async function getLatestBlockhash(banksClient: BanksClient): Promise<Blockhash> {
  const result = await banksClient.getLatestBlockhash();
  if (!result) {
    throw new Error("Couldn't get the latest blockhash");
  }
  return result[0];
}

async function mintTo(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: BN,
  multiSigners: Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID,
): Promise<BanksTransactionMeta> {
  const tx = new Transaction().add(
    token.createMintToInstruction(
      mint,
      destination,
      authority,
      toBigInt(amount),
      multiSigners,
      programId,
    ),
  );

  tx.recentBlockhash = await getLatestBlockhash(banksClient);
  tx.sign(payer, ...multiSigners);

  return await banksClient.processTransaction(tx as BankrunCompatibleTransaction);
}
