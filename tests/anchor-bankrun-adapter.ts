export {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

import {
  SystemProgram,
  Signer,
  PublicKey,
  Keypair,
  Transaction,
  Commitment,
  ConfirmOptions,
  AccountInfo,
} from "@solana/web3.js";

import * as token from "@solana/spl-token";
import {
  BanksClient,
  BanksTransactionMeta,
  ProgramTestContext,
} from "solana-bankrun";

export async function createMint(
  banksClient: BanksClient,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  mintKeypair = Keypair.generate(),
  programId = token.TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  let rent = await banksClient.getRent();

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

// export async function createMintToken2022(
//   banksClient: BanksClient,
//   payer: Keypair,
//   mintAuthority: PublicKey,
//   freezeAuthority: PublicKey | null,
//   decimals: number,
//   mintKeypair = Keypair.generate(),
//   extensions: token.ExtensionType[] = []
// ): Promise<PublicKey> {
//   const mintLen = token.getMintLen(extensions);
//   let rent = await banksClient.getRent();
//   const mintLamports = rent.minimumBalance(BigInt(mintLen));

//   const mint = mintKeypair.publicKey;
//   const tx = new Transaction().add(
//     SystemProgram.createAccount({
//       fromPubkey: payer.publicKey,
//       newAccountPubkey: mint,
//       space: mintLen,
//       lamports: Number(mintLamports),
//       programId: token.TOKEN_2022_PROGRAM_ID,
//     }),

//     token.createInitializeMint2Instruction(
//       mint,
//       decimals,
//       mintAuthority,
//       freezeAuthority,
//       token.TOKEN_2022_PROGRAM_ID
//     )
//   );

//   [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
//   tx.sign(payer, mintKeypair);

//   banksClient.processTransaction(tx);
//   return mint;
// }

export async function createAccount(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  keypair?: Keypair,
  confirmOptions?: ConfirmOptions,
  programId = token.TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  let rent = await banksClient.getRent();
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

  const tx = new Transaction().add(
    SystemProgram.createAccount({
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
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey
): Promise<PublicKey> {
  const ata = token.getAssociatedTokenAddressSync(mint, owner, true, programId);

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

export function getTokenBalanceByATAAccountData(ataData: Uint8Array): string {
  // Amount is located at byte offset 64 and is 8 bytes long
  const amountOffset = 64;
  const amountBytes = ataData.slice(amountOffset, amountOffset + 8);

  // Convert the 8 bytes to a bigint (little-endian)
  const balance = BigInt(
    amountBytes.reduce(
      (acc, byte, index) => acc + BigInt(byte) * (1n << (8n * BigInt(index))),
      0n
    )
  );

  return balance.toString();
}

export async function getMint(
  banksClient: BanksClient,
  address: PublicKey,
  commitment?: Commitment,
  programId = token.TOKEN_PROGRAM_ID
): Promise<token.Mint> {
  const info = await banksClient.getAccount(address, commitment);
  return token.unpackMint(address, info as AccountInfo<Buffer>, programId);
}

// `mintTo` without the mintAuthority signer
// uses bankrun's special `setAccount` function
export async function mintToOverride(
  context: ProgramTestContext,
  destination: PublicKey,
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
      delegate: PublicKey.default,
      delegatedAmount: 0n,
      state: 1,
      isNativeOption: 0,
      isNative: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
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
  payer: Signer,
  mint: PublicKey,
  destination: PublicKey,
  authority: Signer | PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID
): Promise<BanksTransactionMeta> {
  const [authorityPublicKey, signers] = getSigners(authority, multiSigners);

  const tx = new Transaction().add(
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
  payer: Signer,
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey | Signer,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID
): Promise<BanksTransactionMeta> {
  const [ownerPublicKey, signers] = getSigners(owner, multiSigners);

  const tx = new Transaction().add(
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
  signerOrMultisig: Signer | PublicKey,
  multiSigners: Signer[]
): [PublicKey, Signer[]] {
  return signerOrMultisig instanceof PublicKey
    ? [signerOrMultisig, multiSigners]
    : [signerOrMultisig.publicKey, [signerOrMultisig]];
}

export async function getAccount(
  banksClient: BanksClient,
  address: PublicKey,
  commitment?: Commitment,
  programId = token.TOKEN_PROGRAM_ID
): Promise<token.Account> {
  const info = await banksClient.getAccount(address, commitment);
  return token.unpackAccount(address, info as AccountInfo<Buffer>, programId);
}
