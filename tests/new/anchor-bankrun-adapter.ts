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

export async function createAccount(
  banksClient: BanksClient,
  payer: web3.Signer,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  keypair?: web3.Keypair,
  confirmOptions?: web3.ConfirmOptions,
  programId = token.TOKEN_PROGRAM_ID
): Promise<web3.PublicKey> {
  const rent = await banksClient.getRent();
  // If a keypair isn't provided, create the associated token account and return its address
  if (!keypair)
    return await createAssociatedTokenAccount(
      banksClient,
      payer,
      mint,
      owner,
      programId
    );

  // Otherwise, create the account with the provided keypair and return its public key
  const mintState = await getMint(
    banksClient,
    mint,
    confirmOptions?.commitment,
    programId
  );
  const space = token.getAccountLenForMint(mintState);

  const tx = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space,
      lamports: Number(rent.minimumBalance(BigInt(space))),
      programId,
    }),
    token.createInitializeAccountInstruction(
      keypair.publicKey,
      mint,
      owner,
      programId
    )
  );
  [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
  tx.sign(payer, keypair);

  await banksClient.processTransaction(tx);

  return keypair.publicKey;
}

export async function createAssociatedTokenAccount(
  banksClient: BanksClient,
  payer: web3.Signer,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  programId: web3.PublicKey
): Promise<web3.PublicKey> {
  const ata = token.getAssociatedTokenAddressSync(mint, owner, true, programId);

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

export async function getMint(
  banksClient: BanksClient,
  address: web3.PublicKey,
  commitment?: web3.Commitment,
  programId = token.TOKEN_PROGRAM_ID
): Promise<token.Mint> {
  const info = await banksClient.getAccount(address, commitment);
  return token.unpackMint(address, info as web3.AccountInfo<Buffer>, programId);
}

// `mintTo` without the mintAuthority signer
// uses bankrun's special `setAccount` function
export async function mintToOverride(
  context: ProgramTestContext,
  destination: web3.PublicKey,
  amount: bigint
) {
  const banksClient = context.banksClient;

  const existingAccount = await getAccount(banksClient, destination);
  const { mint, owner } = existingAccount;

  const accData = Buffer.alloc(token.ACCOUNT_SIZE);
  token.AccountLayout.encode(
    {
      mint,
      owner,
      amount,
      delegateOption: 0,
      delegate: web3.PublicKey.default,
      delegatedAmount: 0n,
      state: 1,
      isNativeOption: 0,
      isNative: 0n,
      closeAuthorityOption: 0,
      closeAuthority: web3.PublicKey.default,
    },
    accData
  );

  context.setAccount(destination, {
    data: accData,
    executable: false,
    lamports: 1_000_000_000,
    owner: token.TOKEN_PROGRAM_ID,
  });
}

export async function mintTo(
  banksClient: BanksClient,
  payer: web3.Signer,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.Signer | web3.PublicKey,
  amount: number | bigint,
  multiSigners: web3.Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID
): Promise<BanksTransactionMeta> {
  const [authorityPublicKey, signers] = getSigners(authority, multiSigners);

  const tx = new web3.Transaction().add(
    token.createMintToInstruction(
      mint,
      destination,
      authorityPublicKey,
      amount,
      multiSigners,
      programId
    )
  );

  [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
  tx.sign(payer, ...signers);

  return await banksClient.processTransaction(tx);
}

export async function transfer(
  banksClient: BanksClient,
  payer: web3.Signer,
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.PublicKey | web3.Signer,
  amount: number | bigint,
  multiSigners: web3.Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID
): Promise<BanksTransactionMeta> {
  const [ownerPublicKey, signers] = getSigners(owner, multiSigners);

  const tx = new web3.Transaction().add(
    token.createTransferInstruction(
      source,
      destination,
      ownerPublicKey,
      amount,
      multiSigners,
      programId
    )
  );
  [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
  tx.sign(payer, ...signers);

  return await banksClient.processTransaction(tx);
}

export function getSigners(
  signerOrMultisig: web3.Signer | web3.PublicKey,
  multiSigners: web3.Signer[]
): [web3.PublicKey, web3.Signer[]] {
  return signerOrMultisig instanceof web3.PublicKey
    ? [signerOrMultisig, multiSigners]
    : [signerOrMultisig.publicKey, [signerOrMultisig]];
}

export async function getAccount(
  banksClient: BanksClient,
  address: web3.PublicKey,
  commitment?: web3.Commitment,
  programId = token.TOKEN_PROGRAM_ID
): Promise<token.Account> {
  const info = await banksClient.getAccount(address, commitment);
  return token.unpackAccount(
    address,
    info as web3.AccountInfo<Buffer>,
    programId
  );
}
