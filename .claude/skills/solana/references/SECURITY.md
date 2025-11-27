# Solana Security

## Common Vulnerabilities

### 1. Missing Signer Checks

**Vulnerability**: Not verifying that privileged operations require proper signers.

```rust
// VULNERABLE - no signer check
pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
    // Anyone can call this!
    transfer_tokens(...)?;
    Ok(())
}

// SECURE - explicit signer requirement
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,  // Must sign transaction

    #[account(
        mut,
        constraint = vault.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub vault: Account<'info, Vault>,
}
```

### 2. Missing Owner Checks

**Vulnerability**: Not validating account ownership, allowing attackers to pass fake accounts.

```rust
// VULNERABLE - accepts any account
pub fn process(ctx: Context<Process>) -> Result<()> {
    let data = &ctx.accounts.user_data;
    // Attacker can pass account owned by different program!
}

// SECURE - Anchor validates owner automatically for Account<> types
#[derive(Accounts)]
pub struct Process<'info> {
    // Anchor verifies: user_data.owner == program_id
    pub user_data: Account<'info, UserData>,
}

// For UncheckedAccount, validate manually:
/// CHECK: Validated in handler
pub external_account: UncheckedAccount<'info>,

// In handler:
require!(
    external_account.owner == &expected_program,
    ErrorCode::InvalidOwner
);
```

### 3. Integer Overflow/Underflow

**Vulnerability**: Arithmetic operations wrapping without checks.

```rust
// VULNERABLE - can overflow
let total = amount1 + amount2;

// SECURE - use checked math
let total = amount1
    .checked_add(amount2)
    .ok_or(ErrorCode::MathOverflow)?;

// Or use saturating for non-critical paths
let capped = amount.saturating_add(bonus);
```

### 4. Arbitrary CPI (Cross-Program Invocation)

**Vulnerability**: Allowing attackers to invoke arbitrary programs with your PDA's authority.

```rust
// VULNERABLE - arbitrary program call
invoke_signed(
    &instruction,  // Attacker controls this
    &[pda.to_account_info()],
    &[seeds],
)?;

// SECURE - validate target program
require!(
    instruction.program_id == token::ID,
    ErrorCode::InvalidProgram
);
invoke_signed(&instruction, accounts, seeds)?;

// BETTER - use Anchor's CPI wrappers
token::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer { ... },
        signer_seeds,
    ),
    amount,
)?;
```

### 5. PDA Seed Collisions

**Vulnerability**: Different logical entities mapping to the same PDA.

```rust
// VULNERABLE - seeds can collide
// User "alice" with id 1 = User "alice1" with no id
seeds = [b"user", user_name.as_bytes()]

// SECURE - use fixed-length fields or delimiters
seeds = [
    b"user",
    user.key().as_ref(),     // Fixed 32 bytes
    &id.to_le_bytes(),       // Fixed 8 bytes
]
```

### 6. Account Reinitialization

**Vulnerability**: Reinitializing an account that's already been set up.

```rust
// VULNERABLE - can reinitialize
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    ctx.accounts.config.admin = ctx.accounts.new_admin.key();
    Ok(())
}

// SECURE - use init constraint (only works on empty accounts)
#[account(
    init,  // Fails if account already exists
    payer = payer,
    space = 8 + Config::INIT_SPACE,
)]
pub config: Account<'info, Config>,
```

### 7. Closing Account Vulnerabilities

**Vulnerability**: Not zeroing data or allowing resurrection.

```rust
// VULNERABLE - data persists
account.lamports = 0;  // Account can be resurrected in same tx

// SECURE - use Anchor's close constraint
#[account(
    mut,
    close = destination,  // Zeros data, transfers lamports atomically
)]
pub account_to_close: Account<'info, MyAccount>,
```

## Validation Functions

Extract the ix validation logic for reusability and testing:

```rust
// utils/validations.rs
pub fn check_create(
    deposit_amount: u64,
    start_time: u64,
    end_time: u64,
) -> Result<()> {
    if deposit_amount == 0 {
        return Err(ErrorCode::DepositAmountZero.into());
    }
    if start_time == 0 {
        return Err(ErrorCode::StartTimeZero.into());
    }
    if start_time >= end_time {
        return Err(ErrorCode::InvalidTimeRange.into());
    }
    Ok(())
}

// In handler:
pub fn handler(ctx: Context<Create>, amount: u64, start: u64, end: u64) -> Result<()> {
    check_create(amount, start, end)?;
    // ... rest of logic
}
```

## Anchor's Built-in Protections

Anchor provides several automatic security features:

1. **Discriminators**: 8-byte prefix prevents account type confusion
2. **Owner validation**: `Account<>` types validate ownership automatically
3. **Signer validation**: `Signer<>` type enforces signature requirement
4. **Constraint checking**: `#[account(constraint = ...)]` for custom validation
5. **has_one**: Validates account relationships
6. **seeds/bump**: PDA derivation and validation

```rust
#[derive(Accounts)]
pub struct SecureOperation<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,  // Must sign

    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority,  // vault.authority == authority.key()
        constraint = vault.is_active @ ErrorCode::VaultInactive,
    )]
    pub vault: Account<'info, Vault>,  // Owner validated automatically
}
```

## Security Audit Checklist

### Before Deployment

- [ ] All privileged operations require `Signer<>`
- [ ] Account ownership validated (automatic for `Account<>`)
- [ ] PDA seeds are unique and collision-resistant
- [ ] All arithmetic uses checked operations
- [ ] CPI targets are validated
- [ ] Accounts closed properly with `close =`
- [ ] No reinitialization vulnerabilities
- [ ] Events emitted for all state changes
- [ ] Error messages are descriptive
- [ ] Access control documented

### Testing

- [ ] Unit tests in TypeScript
- [ ] Fuzz tests in Rust, via Trident
- [ ] Negative test cases (should fail)
- [ ] Boundary conditions tested

## Resources

- [Neodyme Blog](https://blog.neodyme.io/) - Solana security research
- [sec3 (formerly Soteria)](https://www.sec3.dev/) - Security auditing
- [Solana Security Best Practices](https://docs.solana.com/developing/on-chain-programs/security)
- [Anchor Book - Security](https://www.anchor-lang.com/docs/security)
