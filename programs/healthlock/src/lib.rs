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

    pub fn initialize_organization_counter(ctx: Context<InitializeOrganizationCounter>) -> Result<()> {
        instructions::initialize_organization_counter(ctx)
    }

    pub fn register_organization(
        ctx: Context<RegisterOrganization>,
        name: String,
        contact_info: String,
    ) -> Result<()> {
        instructions::register_organization(ctx, name, contact_info)
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
        record_id: u64,
        organization: Pubkey,
        access_duration: Option<i64>,
    ) -> Result<()> {
        instructions::grant_access(ctx, record_id, organization, access_duration)
    }

    pub fn revoke_access(
        ctx: Context<RevokeAccess>,
        record_id: u64,
        organization: Pubkey,
    ) -> Result<()> {
        instructions::revoke_access(ctx, record_id, organization)
    }

    pub fn update_user_vault(
        ctx: Context<UpdateUserVault>,
        is_active: bool,
    ) -> Result<()> {
       instructions::update_user_vault(ctx, is_active)
    }

    pub fn deactivate_record(ctx: Context<DeactivateRecord>, record_id: u64,) -> Result<()> {
        instructions::deactivate_record(ctx, record_id)
    }
}


