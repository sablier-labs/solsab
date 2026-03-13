# Metaplex Core (MPL Core)

## Overview

MPL Core is Metaplex's next-generation NFT standard. This project uses MPL Core for stream ownership NFTs.

Docs: https://developers.metaplex.com/core

## Why MPL Core?

| Feature       | MPL Core       | Token Metadata                                       |
| ------------- | -------------- | ---------------------------------------------------- |
| Minting Cost  | ~0.0029 SOL    | ~0.022 SOL                                           |
| Compute Units | ~17,000 CU     | ~205,000 CU                                          |
| Account Model | Single account | Multiple accounts (mint + metadata + master edition) |

## Dependencies

```toml
[dependencies]
mpl-core = { version = "0.8", features = ["anchor"] }
```

## Account Validation

Use `BaseCollectionV1` to validate collection accounts:

```rust
use mpl_core::accounts::BaseCollectionV1;

#[derive(Accounts)]
pub struct CreateStream<'info> {
    /// CHECK: Verified via constraint against the treasury's stored collection key.
    #[account(
        mut,
        address = treasury.stream_nft_collection @ LockupError::InvalidNftCollection,
    )]
    pub stream_nft_collection: UncheckedAccount<'info>,

    /// CHECK: Initialized by MPL Core program as a new asset
    #[account(mut)]
    pub stream_nft: UncheckedAccount<'info>,

    pub mpl_core_program: Program<'info, MplCore>,
}
```

Note: Stream NFT is a single `UncheckedAccount` - not mint + metadata + master edition like Token Metadata.

## Creating a Collection (CPI)

Use `CreateCollectionV2CpiBuilder`:

```rust
use mpl_core::instructions::CreateCollectionV2CpiBuilder;

pub fn create_collection(ctx: Context<Initialize>, name: String, uri: String) -> Result<()> {
    CreateCollectionV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .collection(&ctx.accounts.stream_nft_collection.to_account_info())
        .payer(&ctx.accounts.admin.to_account_info())
        .update_authority(Some(&ctx.accounts.treasury.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(name)
        .uri(uri)
        .invoke_signed(&[&[Seed::TREASURY, &[ctx.accounts.treasury.bump]]])?;

    Ok(())
}
```

## Creating an Asset (CPI)

Use `CreateV2CpiBuilder` to mint NFTs into a collection:

```rust
use mpl_core::instructions::CreateV2CpiBuilder;

pub fn create_stream_nft(
    ctx: &Context<CreateStream>,
    name: String,
    uri: String,
    treasury_bump: u8,
) -> Result<()> {
    CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.stream_nft.to_account_info())
        .collection(Some(&ctx.accounts.stream_nft_collection.to_account_info()))
        .authority(Some(&ctx.accounts.treasury.to_account_info()))
        .payer(&ctx.accounts.sender.to_account_info())
        .owner(Some(&ctx.accounts.recipient.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(name)
        .uri(uri)
        .invoke_signed(&[&[Seed::TREASURY, &[treasury_bump]]])?;

    Ok(())
}
```

## Transferring an Asset (CPI)

Use `TransferV1CpiBuilder`:

```rust
use mpl_core::instructions::TransferV1CpiBuilder;

pub fn transfer_stream_nft(
    ctx: &Context<Transfer>,
    new_owner: &AccountInfo,
) -> Result<()> {
    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.stream_nft.to_account_info())
        .collection(Some(&ctx.accounts.stream_nft_collection.to_account_info()))
        .payer(&ctx.accounts.caller.to_account_info())
        .authority(Some(&ctx.accounts.caller.to_account_info()))
        .new_owner(new_owner)
        .system_program(Some(&ctx.accounts.system_program.to_account_info()))
        .invoke()?;

    Ok(())
}
```

## Key Differences from Token Metadata

| Aspect                | MPL Core                | Token Metadata                      |
| --------------------- | ----------------------- | ----------------------------------- |
| NFT accounts          | 1 (`stream_nft`)        | 3+ (mint, metadata, master_edition) |
| Collection validation | `BaseCollectionV1`      | Seeds + program constraint          |
| CPI builders          | `*V2CpiBuilder`         | `CreateMetadataAccountsV3` etc.     |
| Authority model       | Single update authority | Separate mint/update authorities    |
