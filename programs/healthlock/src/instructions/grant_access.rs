use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::ErrorCode;
use crate::events::*;

pub fn grant_access(
    ctx: Context<GrantAccess>,
    _record_id: u64,
    organization: Pubkey,
    access_duration: Option<i64>,
) -> Result<()> {
    let health_record = &mut ctx.accounts.health_record;

    require!(health_record.is_active, ErrorCode::RecordDeactivated);
    require!(
        health_record.owner == ctx.accounts.owner.key(),
        ErrorCode::UnauthorizedAccess
    );

    let existing_access = health_record.access_list.iter().find(|access| 
        access.organization == organization && access.is_active
    );
    require!(existing_access.is_none(), ErrorCode::AccessAlreadyGranted);

    require!(health_record.access_list.len() < 100, ErrorCode::MaxAccessReached);
        
    let expires_at = if let Some(duration) = access_duration {
        Some(Clock::get()?.unix_timestamp + duration)
    } else {
        None
    };
    
    let access_permission = AccessPermission {
        organization,
        granted_at: Clock::get()?.unix_timestamp,
        expires_at,
        is_active: true,
    };
    
    health_record.access_list.push(access_permission);
    
    emit!(AccessGranted {
        record_owner: ctx.accounts.owner.key(),
        record_id: health_record.record_id.to_string(),
        organization,
        expires_at,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("Access granted to organization: {:?} for record: {}", organization, health_record.record_id);

    Ok(())
}

#[derive(Accounts)]
#[instruction(record_id: u64)]
pub struct GrantAccess<'info> {
    #[account(
        mut,
        seeds = [b"health_record", owner.key().as_ref(), record_id.to_le_bytes().as_ref()],
        bump
    )]
    pub health_record: Account<'info, HealthRecord>,

    #[account(mut)]
    pub owner: Signer<'info>,
}
