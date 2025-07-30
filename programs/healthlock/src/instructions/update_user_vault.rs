use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::{state::*, ANCHOR_DESCRIMINATOR_SIZE};

pub fn update_user_vault(ctx: Context<UpdateUserVault>, age:u64, name: String) -> Result<()> {
    let user_vault = &mut ctx.accounts.user_vault;
    let current_timestamp = Clock::get()?.unix_timestamp;

    if user_vault.owner == Pubkey::default() {
        user_vault.owner = ctx.accounts.owner.key();
        user_vault.record_ids = Vec::new();
        user_vault.created_at = current_timestamp;
    }

    require!(
        user_vault.owner == ctx.accounts.owner.key(),
        ErrorCode::UnauthorizedAccess
    );

    user_vault.age = age;
    user_vault.name = name;


    msg!("User vault updated.");
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateUserVault<'info> {
    #[account(
        init_if_needed,
        payer = owner,
        space = ANCHOR_DESCRIMINATOR_SIZE + UserVault::INIT_SPACE,
        seeds = [b"user_vault", owner.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,

}
