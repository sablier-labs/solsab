use crate::{fuzz_accounts::AccountAddresses, helpers::*};
use trident_fuzz::fuzzing::*;

/// Shared account fields for Withdraw and WithdrawMax instructions.
#[derive(Clone)]
pub struct WithdrawAccounts {
    pub signer: Pubkey,
    pub withdrawal_recipient: Pubkey,
    pub withdrawal_recipient_ata: Pubkey,
    pub treasury: Pubkey,
    pub deposited_token_mint: Pubkey,
    pub stream_data: Pubkey,
    pub stream_data_ata: Pubkey,
    pub stream_nft: Pubkey,
    pub chainlink_program: Pubkey,
    pub chainlink_sol_usd_feed: Pubkey,
    pub deposited_token_program: Pubkey,
}

/// Sets up all accounts needed for Withdraw/WithdrawMax and captures pre-transaction balances.
/// Returns (accounts, recipient_ata_balance_before, stream_data_ata_balance_before).
pub fn setup_withdraw_accounts(
    trident: &mut Trident,
    fuzz_accounts: &mut AccountAddresses,
    withdraw_to_recipient: bool,
) -> (WithdrawAccounts, u64, u64) {
    // Get stream recipient (owner of the stream NFT)
    let stream_recipient = fuzz_accounts.recipient.get(trident).unwrap();

    // Determine signer and withdrawal_recipient based on scenario
    let (signer, withdrawal_recipient) = if withdraw_to_recipient {
        // Anyone can sign, tokens go to stream_recipient
        let signer = fuzz_accounts.signer.get(trident).unwrap();
        (signer, stream_recipient)
    } else {
        // Stream recipient must sign, tokens can go to any address
        let random_recipient = trident.payer().pubkey();
        (stream_recipient, random_recipient)
    };

    // Get deposit token info
    let deposited_token_mint = fuzz_accounts.deposit_token_mint.get(trident).unwrap();
    let deposited_token_program = fuzz_accounts.deposit_token_program.get(trident).unwrap();

    // Get treasury
    let treasury = fuzz_accounts.treasury.get(trident).unwrap();

    // Get stream NFT (MPL Core asset)
    let stream_nft = fuzz_accounts.stream_nft.get(trident).unwrap();

    // Get stream data PDA
    let stream_data = fuzz_accounts.stream_data.get(trident).unwrap();

    // Derive withdrawal recipient ATA (init_if_needed in the instruction)
    let withdrawal_recipient_ata = fuzz_accounts.withdrawal_recipient_ata.insert(
        trident,
        Some(PdaSeeds::new(
            &[withdrawal_recipient.as_ref(), deposited_token_program.as_ref(), deposited_token_mint.as_ref()],
            ASSOCIATED_TOKEN_PROGRAM_ID.parse().unwrap(),
        )),
    );

    // Get stream data ATA
    let stream_data_ata = fuzz_accounts.stream_data_ata.get(trident).unwrap();

    // Get chainlink accounts
    let chainlink_program: Pubkey = CHAINLINK_PROGRAM_ID.parse().unwrap();
    let chainlink_sol_usd_feed: Pubkey = CHAINLINK_SOL_USD_FEED_ID.parse().unwrap();

    let accounts = WithdrawAccounts {
        signer,
        withdrawal_recipient,
        withdrawal_recipient_ata,
        treasury,
        deposited_token_mint,
        stream_data,
        stream_data_ata,
        stream_nft,
        chainlink_program,
        chainlink_sol_usd_feed,
        deposited_token_program,
    };

    // Capture balances before withdraw
    let recipient_ata_balance_before = get_ata_token_balance(trident, &withdrawal_recipient_ata);
    let stream_data_ata_balance_before = get_ata_token_balance(trident, &stream_data_ata);

    (accounts, recipient_ata_balance_before, stream_data_ata_balance_before)
}

/// Shared assertions for Withdraw and WithdrawMax.
pub fn assert_withdraw(
    trident: &mut Trident,
    accounts: &WithdrawAccounts,
    withdraw_amount: u64,
    recipient_ata_balance_before: u64,
    stream_data_ata_balance_before: u64,
) {
    // Get stream data after withdrawal
    let stream_data = get_stream_data(trident, &accounts.stream_data);

    // Verify withdrawn amount increased by the withdraw_amount
    assert_eq!(stream_data.amounts.withdrawn, withdraw_amount, "withdrawn amount should increase by withdraw_amount");

    // Verify recipient ATA balance increased by withdraw_amount
    let recipient_ata_balance_after = get_ata_token_balance(trident, &accounts.withdrawal_recipient_ata);
    assert_eq!(
        recipient_ata_balance_after - recipient_ata_balance_before,
        withdraw_amount,
        "recipient ATA balance should increase by withdraw_amount"
    );

    // Verify stream_data_ata balance decreased by withdraw_amount
    let stream_data_ata_balance_after = get_ata_token_balance(trident, &accounts.stream_data_ata);
    assert_eq!(
        stream_data_ata_balance_before - stream_data_ata_balance_after,
        withdraw_amount,
        "stream_data_ata balance should decrease by withdraw_amount"
    );

    // Verify is_depleted is true if withdrawn + refunded >= deposited
    if stream_data.amounts.withdrawn + stream_data.amounts.refunded >= stream_data.amounts.deposited {
        assert!(stream_data.is_depleted, "is_depleted should be true when withdrawn + refunded = deposited");
    }

    // Universal invariants
    check_universal_invariants(trident, &accounts.stream_data, &accounts.stream_data_ata);
}
