use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::ErrorCode;
use crate::events::*;

pub fn deactivate_record(ctx: Context<DeactivateRecord>, _record_id: u64) -> Result<()> {
    let user_vault = &mut ctx.accounts.user_vault;
    let health_record = &mut ctx.accounts.health_record;

    require!(
        user_vault.owner == ctx.accounts.owner.key(),
        ErrorCode::UnauthorizedAccess
    );
    require!(
        health_record.owner == ctx.accounts.owner.key(),
        ErrorCode::UnauthorizedAccess
    );

    // Remove record ID from user vault
    user_vault
        .record_ids
        .retain(|&id| id != health_record.record_id);

    emit!(HealthRecordDeactivated {
        owner: ctx.accounts.owner.key(),
        record_id: health_record.record_id.to_string(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Health record deactivated: {}", health_record.record_id);
    Ok(())
}

#[derive(Accounts)]
#[instruction(record_id: u64)]
pub struct DeactivateRecord<'info> {
    #[account(
        mut,
        seeds = [b"user_vault", owner.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        mut,
        seeds = [b"health_record", owner.key().as_ref(), record_id.to_le_bytes().as_ref()],
        bump
    )]
    pub health_record: Account<'info, HealthRecord>,

    #[account(mut)]
    pub owner: Signer<'info>,
}
