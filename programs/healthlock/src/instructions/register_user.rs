use anchor_lang::prelude::*;

use crate::{events::*, ANCHOR_DESCRIMINATOR_SIZE, state::*};


pub fn register_user(ctx: Context<RegisterUser>) -> Result<()> {
    let user_vault = &mut ctx.accounts.user_vault;
    user_vault.owner = ctx.accounts.owner.key();
    user_vault.record_ids = Vec::new();
    user_vault.created_at = Clock::get()?.unix_timestamp;
    user_vault.is_active = true;

    emit!(UserRegistered {
        owner: ctx.accounts.owner.key(),
        vault: user_vault.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("User registered successfully: {:?}", ctx.accounts.owner.key());
    Ok(())
}

#[derive(Accounts)]
pub struct RegisterUser<'info> {
    #[account(
        init,
        payer = owner,
        space = ANCHOR_DESCRIMINATOR_SIZE + UserVault::INIT_SPACE,
        seeds = [
            b"user_vault", 
            owner.key().as_ref()
        ],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}
