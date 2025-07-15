use anchor_lang::prelude::*;

use crate::state::*;

pub fn update_user_vault(
    ctx: Context<UpdateUserVault>,
    is_active: bool,
) -> Result<()> {
    msg!("unimplemented: {:?}", ctx.program_id);
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

