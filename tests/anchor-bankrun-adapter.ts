import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
  TransactionInstruction as TxIx,
} from "@solana/web3.js";
import { BanksClient, BanksTransactionMeta } from "solana-bankrun";

export async function buildSignAndProcessTx(
  banksClient: BanksClient,
  ixs: TxIx | TxIx[],
  signerKeys: Keypair | Keypair[],
  cuLimit: number = 1_400_000 // The maximum Compute Unit limit for a tx
) {
  // Get the latest blockhash
  const res = await banksClient.getLatestBlockhash();
  if (!res) throw new Error("Couldn't get the latest blockhash");

  // Initialize the transaction
  const tx = new Transaction();
  tx.recentBlockhash = res[0];

  // Add compute unit limit instruction if specified
  if (cuLimit !== undefined) {
    const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: cuLimit,
    });
    tx.add(cuLimitIx);
  }

  // Add instructions to the transaction
  const internal_ixs: TxIx[] = Array.isArray(ixs) ? ixs : [ixs];
  internal_ixs.forEach((ix) => tx.add(ix));

  // Ensure `signerKeys` is always an array
  const signers = Array.isArray(signerKeys) ? signerKeys : [signerKeys];

  // Sign the transaction with all provided signers
  tx.sign(...signers);

  // Process the transaction
  const txMeta = await banksClient.processTransaction(tx);
  return txMeta;
}

export async function createMint(
  banksClient: BanksClient,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  mintKeypair = Keypair.generate(),
  programId = token.TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const rent = await banksClient.getRent();

  const mint = mintKeypair.publicKey;
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      space: token.MINT_SIZE,
      lamports: Number(rent.minimumBalance(BigInt(token.MINT_SIZE))),
      programId,
    }),

    token.createInitializeMint2Instruction(
      mint,
      decimals,
      mintAuthority,
      freezeAuthority,
      programId
    )
  );
  [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
  tx.sign(payer, mintKeypair);

  await banksClient.processTransaction(tx);
  return mint;
}

export async function createATA(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey
): Promise<PublicKey> {
  const ata = deriveATAAddress(mint, owner, programId);

  const tx = new Transaction().add(
    token.createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata,
      owner,
      mint,
      programId
    )
  );

  [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
  tx.sign(payer);

  await banksClient.processTransaction(tx);

  return ata;
}

export async function createATAAndFund(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  amount: number,
  tokenProgram: PublicKey,
  user: PublicKey
): Promise<PublicKey> {
  // Create ATA for the user
  const userATA = await createATA(banksClient, payer, mint, user, tokenProgram);

  // Mint the amount to the user's ATA
  await mintTo(
    banksClient,
    payer,
    mint,
    userATA,
    payer.publicKey,
    amount,
    [],
    tokenProgram
  );

  return userATA;
}

export function deriveATAAddress(
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey
): PublicKey {
  return token.getAssociatedTokenAddressSync(mint, owner, true, programId);
}

export async function getATABalanceMint(
  banksClient: BanksClient,
  owner: PublicKey,
  mint: PublicKey
): Promise<BN> {
  const mintAccount = await banksClient.getAccount(mint);

  if (!mintAccount) {
    throw new Error("Mint account does not exist!");
  }

  // Derive the ATA address from owner and mint
  const ataAddress = await token.getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    mintAccount.owner
  );

  // Get the ATA account data
  const ataAccount = await banksClient.getAccount(ataAddress);
  if (!ataAccount) {
    throw new Error("The queried ATA account does not exist!");
  }

  const accountData = token.AccountLayout.decode(ataAccount.data);
  return new BN(accountData.amount.toString());
}

export async function getATABalance(
  banksClient: BanksClient,
  ataAddress: PublicKey
): Promise<BN> {
  const ataAccount = await banksClient.getAccount(ataAddress);
  if (!ataAccount) {
    throw new Error("The queried ATA account does not exist!");
  }

  const accountData = token.AccountLayout.decode(ataAccount.data);
  return new BN(accountData.amount.toString());
}

export async function getMintTotalSupplyOf(
  banksClient: BanksClient,
  mintAddress: PublicKey
): Promise<BN> {
  const mintAccount = await banksClient.getAccount(mintAddress);
  if (!mintAccount) {
    throw new Error("The queried mint account does not exist!");
  }

  const mintData = token.MintLayout.decode(mintAccount.data);
  return new BN(mintData.supply.toString());
}

export async function mintTo(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID
): Promise<BanksTransactionMeta> {
  const tx = new Transaction().add(
    token.createMintToInstruction(
      mint,
      destination,
      authority,
      amount,
      multiSigners,
      programId
    )
  );

  [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
  tx.sign(payer, ...multiSigners);

  return await banksClient.processTransaction(tx);
}

export async function transfer(
  banksClient: BanksClient,
  payer: Signer,
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID
): Promise<BanksTransactionMeta> {
  const tx = new Transaction().add(
    token.createTransferInstruction(
      source,
      destination,
      owner,
      amount,
      multiSigners,
      programId
    )
  );
  [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
  tx.sign(payer, ...multiSigners);

  return await banksClient.processTransaction(tx);
}
