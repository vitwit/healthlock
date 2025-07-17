use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::state::*;

pub fn update_user_vault(ctx: Context<UpdateUserVault>, is_active: bool) -> Result<()> {
    let user_vault = &mut ctx.accounts.user_vault;

    require!(
        user_vault.owner == ctx.accounts.owner.key(),
        ErrorCode::UnauthorizedAccess
    );

    user_vault.is_active = is_active;

    msg!("User vault updated. Active status: {}", is_active);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateUserVault<'info> {
    #[account(
        mut,
        seeds = [b"user_vault", owner.key().as_ref()],
        bump
    )]
    
    pub user_vault: Account<'info, UserVault>,

    #[account(mut)]
    pub owner: Signer<'info>,
}
