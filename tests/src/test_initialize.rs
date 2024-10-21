use anchor_client::{
    anchor_lang::{AnchorSerialize, ToAccountMetas},
    solana_sdk::{
        instruction::Instruction,
        pubkey::Pubkey,
        signature::{keypair_from_seed, Keypair},
        signer::Signer,
        system_instruction,
        transaction::Transaction,
    },
};

use spl_token::{
    id, instruction,
    solana_program::{
        program_pack::Pack, system_instruction::create_account as create_account_ix, system_program,
    },
    state::{Account, Mint},
};

use solana_test_framework::{/*processor,*/ tokio, ProgramTest};

#[tokio::test]
async fn test_create_stream() {
    let program_test = ProgramTest::new(
        "solsab",
        solsab::id(),
        None, /*processor!(solsab::entry)*/
    );
    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    let mint_account = Keypair::new();
    let owner = Keypair::new();
    let token_program = &id();
    let rent = banks_client.get_rent().await.unwrap();
    let mint_rent = rent.minimum_balance(Mint::LEN);

    let token_mint_a_account_ix = create_account_ix(
        &payer.pubkey(),
        &mint_account.pubkey(),
        mint_rent,
        Mint::LEN as u64,
        token_program,
    );

    let token_mint_a_ix = instruction::initialize_mint(
        token_program,
        &mint_account.pubkey(),
        &owner.pubkey(),
        None,
        9,
    )
    .unwrap();

    // create mint transaction
    let token_mint_a_tx = Transaction::new_signed_with_payer(
        &[token_mint_a_account_ix, token_mint_a_ix],
        Some(&payer.pubkey()),
        &[&payer, &mint_account],
        recent_blockhash,
    );

    banks_client
        .process_transaction(token_mint_a_tx)
        .await
        .unwrap();

    // Create account that can hold the newly minted tokens for the sender
    let account_rent = rent.minimum_balance(Account::LEN);
    let sender_token_account = Keypair::new();
    let create_sender_account_ix = system_instruction::create_account(
        &payer.pubkey(),
        &sender_token_account.pubkey(),
        account_rent,
        Account::LEN as u64,
        token_program,
    );

    let owner_account = Keypair::new();
    let sender_initialize_account_ix = instruction::initialize_account(
        token_program,
        &sender_token_account.pubkey(),
        &mint_account.pubkey(),
        &owner_account.pubkey(),
    )
    .unwrap();

    let create_sender_token_account_tx = Transaction::new_signed_with_payer(
        &[create_sender_account_ix, sender_initialize_account_ix],
        Some(&payer.pubkey()),
        &[&payer, &sender_token_account],
        recent_blockhash,
    );
    banks_client
        .process_transaction(create_sender_token_account_tx)
        .await
        .unwrap();

    let receiver = keypair_from_seed(b"The seed for creating a keypair for the receiver").unwrap();

    // Create account that can hold the newly minted tokens for the recipient
    let account_rent = rent.minimum_balance(Account::LEN);
    let recipient_token_account = Keypair::new();
    let create_recipient_account_ix = system_instruction::create_account(
        &payer.pubkey(),
        &recipient_token_account.pubkey(),
        account_rent,
        Account::LEN as u64,
        token_program,
    );

    let recipient_initialize_account_ix = instruction::initialize_account(
        token_program,
        &recipient_token_account.pubkey(),
        &mint_account.pubkey(),
        &owner_account.pubkey(),
    )
    .unwrap();

    let create_recipient_token_account_tx = Transaction::new_signed_with_payer(
        &[create_recipient_account_ix, recipient_initialize_account_ix],
        Some(&payer.pubkey()),
        &[&payer, &recipient_token_account],
        recent_blockhash,
    );
    banks_client
        .process_transaction(create_recipient_token_account_tx)
        .await
        .unwrap();

    // Mint tokens into newly created account
    let mint_amount: u64 = 100;
    let mint_to_ix = instruction::mint_to(
        token_program,
        &mint_account.pubkey(),
        &sender_token_account.pubkey(),
        &owner.pubkey(),
        &[],
        mint_amount,
    )
    .unwrap();

    let mint_to_tx = Transaction::new_signed_with_payer(
        &[mint_to_ix],
        Some(&payer.pubkey()),
        &[&payer, &owner],
        recent_blockhash,
    );
    banks_client.process_transaction(mint_to_tx).await.unwrap();

    // Inspect account
    let token_account_info = banks_client
        .get_account(sender_token_account.pubkey())
        .await
        .unwrap()
        .expect("could not fetch account information");
    let account_data = Account::unpack(&token_account_info.data).unwrap();
    println!("account data: {:?}", account_data);
    assert_eq!(
        account_data.amount,
        mint_amount.clone(),
        "not correct amount"
    );

    // TODO:
    // 1. Create a Token Mint Account
    // 2. Create an Associated Token Account for the sender
    // 3. Mint some tokens to the sender
    // 4. Create an Associated Token Account for the receiver
    // 5. Abstract the above steps into a helper function

    let initialize_ix = Instruction {
        program_id: solsab::id(),
        data: solsab::instruction::CreateLockupLinearStream {
            amount: mint_amount,
        }
        .try_to_vec()
        .unwrap(),
        accounts: solsab::accounts::CreateLockupLinearStream {
            sender: payer.pubkey(),
            sender_ata: sender_token_account.pubkey(),
            recipient_ata: recipient_token_account.pubkey(),
            stream: Pubkey::new_unique(),
            token_program: *token_program,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    };

    let initialize_tx = Transaction::new_signed_with_payer(
        &[initialize_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    banks_client
        .process_transaction(initialize_tx)
        .await
        .unwrap();

    // println!("Your transaction signature {}", tx);
}
