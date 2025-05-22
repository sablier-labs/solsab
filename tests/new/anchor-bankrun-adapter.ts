import web3 from "@solana/web3.js";

import * as token from "@solana/spl-token";

import {
  BanksClient,
  BanksTransactionMeta,
  ProgramTestContext,
} from "solana-bankrun";

import { BN } from "@coral-xyz/anchor";

export async function createMint(
  banksClient: BanksClient,
  payer: web3.Keypair,
  mintAuthority: web3.PublicKey,
  freezeAuthority: web3.PublicKey | null,
  decimals: number,
  mintKeypair = web3.Keypair.generate(),
  programId = token.TOKEN_PROGRAM_ID
): Promise<web3.PublicKey> {
  const rent = await banksClient.getRent();

  const mint = mintKeypair.publicKey;
  const tx = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
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
  payer: web3.Signer,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  programId: web3.PublicKey
): Promise<web3.PublicKey> {
  const ata = deriveATAAddress(mint, owner, programId);

  const tx = new web3.Transaction().add(
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

export function deriveATAAddress(
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  programId: web3.PublicKey
): web3.PublicKey {
  return token.getAssociatedTokenAddressSync(mint, owner, true, programId);
}

export async function getATABalance(
  banksClient: BanksClient,
  ataAddress: web3.PublicKey
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
  mintAddress: web3.PublicKey
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
  payer: web3.Signer,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.PublicKey,
  amount: number | bigint,
  multiSigners: web3.Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID
): Promise<BanksTransactionMeta> {
  const tx = new web3.Transaction().add(
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
