use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::events::*;
use crate::state::*;

pub fn revoke_access(ctx: Context<RevokeAccess>, _record_id: u64, organization: Pubkey) -> Result<()> {
    let health_record = &mut ctx.accounts.health_record;

    require!(health_record.is_active, ErrorCode::RecordDeactivated);
    require!(
        health_record.owner == ctx.accounts.owner.key(),
        ErrorCode::UnauthorizedAccess
    );

    let access_index = health_record
        .access_list
        .iter()
        .position(|access| access.organization == organization && access.is_active)
        .ok_or(ErrorCode::AccessNotFound)?;

    health_record.access_list[access_index].is_active = false;

    emit!(AccessRevoked {
        record_owner: ctx.accounts.owner.key(),
        record_id: health_record.record_id.to_string(),
        organization,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Access revoked from organization: {:?} for record: {}",
        organization,
        health_record.record_id
    );
    Ok(())
}

#[derive(Accounts)]
#[instruction(record_id: u64)]
pub struct RevokeAccess<'info> {
    #[account(
        mut,
        seeds = [b"health_record", owner.key().as_ref(), record_id.to_le_bytes().as_ref()],
        bump
    )]
    pub health_record: Account<'info, HealthRecord>,

    #[account(mut)]
    pub owner: Signer<'info>,
}
