use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::events::*;
use crate::state::*;

pub fn revoke_access(
    ctx: Context<RevokeAccess>,
    record_id: u64,
    organization: Pubkey,
) -> Result<()> {
    let health_record = &mut ctx.accounts.health_record;
    let organization_account = &mut ctx.accounts.organization;

    require!(
        health_record.owner == ctx.accounts.owner.key(),
        ErrorCode::UnauthorizedAccess
    );

    require!(
        organization_account.owner.key() == organization,
        ErrorCode::InvalidOrganization
    );

    let access_index = health_record
        .access_list
        .iter()
        .position(|access| access.organization == organization)
        .ok_or(ErrorCode::AccessNotFound)?;

    health_record.access_list.remove(access_index);

    let record_index = organization_account
        .record_ids
        .iter()
        .position(|&id| id == record_id)
        .ok_or(ErrorCode::RecordNotFoundInOrganization)?;
    
    organization_account.record_ids.remove(record_index);
    

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

    #[account(
        mut,
        seeds = [b"organization", organization.owner.as_ref()],
        bump,
    )]
    pub organization: Account<'info, Organization>,

    #[account(mut)]
    pub owner: Signer<'info>,
}
