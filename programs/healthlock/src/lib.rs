use anchor_lang::prelude::*;

pub mod state;
pub mod events;
pub mod error;
pub mod instructions;
use instructions::*;
use state::*;

declare_id!("BD5UPzmwnKQ8oAhDaViS9dXopBf5wVZ57RAngCtwEdkQ");

pub const ANCHOR_DESCRIMINATOR_SIZE: usize = 8;

#[program]
pub mod healthlock {
    use super::*;

    pub fn initialize_record_counter(ctx: Context<InitializeRecordCounter>) -> Result<()> {
        instructions::initialize_record_counter(ctx)
    }

    pub fn register_user(ctx: Context<RegisterUser>) -> Result<()> {
        instructions::register_user(ctx)
    }

    pub fn upload_health_record(
        ctx: Context<UploadHealthRecord>,
        encrypted_data: Vec<u8>,
        metadata: RecordMetadata,
    ) -> Result<()> {
        instructions::upload_health_record(ctx, encrypted_data, metadata)
    }

    pub fn grant_access(
        ctx: Context<GrantAccess>,
        organization: Pubkey,
        access_duration: Option<i64>,
    ) -> Result<()> {
        instructions::grant_access(ctx, organization, access_duration)
    }

    pub fn revoke_access(
        ctx: Context<RevokeAccess>,
        organization: Pubkey,
    ) -> Result<()> {
        instructions::revoke_access(ctx, organization)
    }

    pub fn update_user_vault(
        ctx: Context<UpdateUserVault>,
        is_active: bool,
    ) -> Result<()> {
       instructions::update_user_vault(ctx, is_active)
    }

    pub fn deactivate_record(ctx: Context<DeactivateRecord>) -> Result<()> {
        instructions::deactivate_record(ctx)
    }
}


