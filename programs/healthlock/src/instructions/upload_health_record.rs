use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::state::*;
use crate::events::*;
use crate::ANCHOR_DESCRIMINATOR_SIZE;

pub fn upload_health_record(
    ctx: Context<UploadHealthRecord>,
    encrypted_data: Vec<u8>,
    metadata: RecordMetadata,
) -> Result<()> {
    require!(encrypted_data.len() <= 1000, ErrorCode::RecordTooLarge);
    require!(
        metadata.description.len() <= 100,
        ErrorCode::DescriptionTooLong
    );
    require!(metadata.file_type.len() <= 100, ErrorCode::FileTypeTooLong);

    let user_vault = &mut ctx.accounts.user_vault;
    let record_counter = &mut ctx.accounts.record_counter;
    let health_record = &mut ctx.accounts.health_record;

    require!(user_vault.is_active, ErrorCode::VaultDeactivated);
    require!(
        user_vault.owner == ctx.accounts.owner.key(),
        ErrorCode::UnauthorizedAccess
    );
    require!(
        user_vault.record_ids.len() < 100,
        ErrorCode::MaxRecordsReached
    );

    health_record.owner = ctx.accounts.owner.key();
    health_record.record_id = record_counter.record_id;
    health_record.encrypted_data = encrypted_data;
    health_record.metadata = metadata;
    health_record.created_at = Clock::get()?.unix_timestamp;
    health_record.access_list = Vec::new();
    health_record.is_active = true;

    user_vault.record_ids.push(record_counter.record_id);

    emit!(HealthRecordUploaded {
        owner: ctx.accounts.owner.key(),
        record_id: record_counter.record_id.to_string(),
        record_account: health_record.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    record_counter.record_id += 1;

    msg!(
        "Health record uploaded successfully with ID: {}",
        health_record.record_id
    );

    Ok(())
}

#[derive(Accounts)]
pub struct UploadHealthRecord<'info> {
    #[account(
        mut,
        seeds = [b"user_vault", owner.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        mut,
        seeds = [b"record_counter"],
        bump
    )]
    pub record_counter: Account<'info, RecordCounter>,

    #[account(
        init,
        payer = owner,
        space = ANCHOR_DESCRIMINATOR_SIZE + HealthRecord::INIT_SPACE,
        seeds = [b"health_record", owner.key().as_ref(), record_counter.record_id.to_le_bytes().as_ref()],
        bump
    )]
    pub health_record: Account<'info, HealthRecord>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}
