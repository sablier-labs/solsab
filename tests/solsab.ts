import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
// import { getCustomErrorMessage } from "@solana-developers/helpers";
// import { assert } from "chai";
// import { systemProgramErrors } from "./system-errors";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Solsab } from "../target/types/solsab";
const web3 = anchor.web3;

describe("solsab", () => {
  // Use the cluster and the keypair from Anchor.toml
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;

  const sender = (provider.wallet as anchor.Wallet).payer;
  console.log(`Sender: ${sender.publicKey}`);
  const program = anchor.workspace.solsab as Program<Solsab>;

  before(async () => {
    const balance = await connection.getBalance(sender.publicKey);
    const balanceInSOL = balance / web3.LAMPORTS_PER_SOL;
    const formattedBalance = new Intl.NumberFormat().format(balanceInSOL);
    console.log(`Balance: ${formattedBalance} SOL`);
  });

  it("Creates a LockupLinear Stream", async () => {
    const TOKEN_DECIMALS = 2;
    const mintAuthority = null;
    const tokenMint = await createMint(
      connection,
      sender,
      sender.publicKey,
      mintAuthority,
      TOKEN_DECIMALS
    );
    console.log(`Token Mint: ${tokenMint}`);

    const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, TOKEN_DECIMALS);

    const senderAssociatedTokenAccount =
      await getOrCreateAssociatedTokenAccount(
        connection,
        sender,
        tokenMint,
        sender.publicKey
      );
    console.log(`Sender ATA: ${senderAssociatedTokenAccount.address}`);

    const txSignature = await mintTo(
      connection,
      sender,
      tokenMint,
      senderAssociatedTokenAccount.address,
      sender,
      10 * MINOR_UNITS_PER_MAJOR_UNITS
    );

    const recipient = anchor.web3.Keypair.generate();
    const recipientAssociatedTokenAccount =
      await getOrCreateAssociatedTokenAccount(
        connection,
        sender, //TODO: why can't recipient be the signer, even if they're airdropped SOL?
        tokenMint,
        recipient.publicKey
      );
    console.log(`Recipient ATA: ${recipientAssociatedTokenAccount.address}`);

    console.log(
      `Minted ${10 * MINOR_UNITS_PER_MAJOR_UNITS} tokens to the Sender ATA`
    );

    const amount = new anchor.BN(6);

    await program.methods
      .createLockupLinearStream(amount)
      .accounts({
        mint: tokenMint,
        senderAta: senderAssociatedTokenAccount.address,
        recipientAta: recipientAssociatedTokenAccount.address,
      })
      .signers([sender])
      .rpc();
  });
});
