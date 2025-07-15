use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::ErrorCode;
use crate::ANCHOR_DESCRIMINATOR_SIZE;

pub fn upload_health_record(
    ctx: Context<UploadHealthRecord>,
    encrypted_data: Vec<u8>,
    metadata: RecordMetadata,
) -> Result<()> {
    require!(
        encrypted_data.len() <= 1000,
        ErrorCode::RecordTooLarge
    );
    require!(
        metadata.description.len() <= 100,
        ErrorCode::DescriptionTooLong
    );
    require!(
        metadata.file_type.len() <= 100,
        ErrorCode::FileTypeTooLong
    );

    msg!("unimplemented: {:?}", ctx.program_id);
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
