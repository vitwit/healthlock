use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::state::*;
use crate::events::*;
use crate::ANCHOR_DESCRIMINATOR_SIZE;

pub fn upload_health_record(
    ctx: Context<UploadHealthRecord>,
    encrypted_data: String,
    mime_type: String,
    file_size: u64,
    description: String,
    title: String,
) -> Result<()> {
    let user_vault = &mut ctx.accounts.user_vault;
    let record_counter = &mut ctx.accounts.record_counter;
    let health_record = &mut ctx.accounts.health_record;
    let current_timestamp = Clock::get()?.unix_timestamp;

    if !user_vault.is_active {
        user_vault.owner = ctx.accounts.owner.key();
        user_vault.record_ids = Vec::new();
        user_vault.created_at = current_timestamp;
        user_vault.is_active = true;
    }
   
    health_record.owner = ctx.accounts.owner.key();
    health_record.record_id = record_counter.record_id;
    health_record.encrypted_data = encrypted_data;
    health_record.mime_type = mime_type;
    health_record.created_at = Clock::get()?.unix_timestamp;
    health_record.access_list = Vec::new();
    health_record.file_size = file_size;
    health_record.title = title;
    health_record.description = description;
    
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
        init_if_needed,
        payer = owner,
        space = ANCHOR_DESCRIMINATOR_SIZE + UserVault::INIT_SPACE,
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
        space = ANCHOR_DESCRIMINATOR_SIZE 
            + 32 
            + 8 
            + 4 + 1000 
            + 4 + 100  
            + 4 + 100  
            + 8  
            + 8  
            + 8  
            + 4  
            + 1  
            + 100
            + 1000,
        seeds = [b"health_record", owner.key().as_ref(), record_counter.record_id.to_le_bytes().as_ref()],
        bump
    )]
    pub health_record: Account<'info, HealthRecord>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}