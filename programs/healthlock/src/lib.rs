use anchor_lang::prelude::*;

pub mod state;
pub mod events;
pub mod error;
pub mod instructions;
use instructions::*;
use state::*;

declare_id!("5PVKhLRUvDnc9tRAwXRroECjeibeT8oTjD5duYte1nuX");

pub const ANCHOR_DESCRIMINATOR_SIZE: usize = 8;

#[program]
pub mod healthlock {
    use super::*;

    pub fn initialize_record_counter(ctx: Context<InitializeRecordCounter>) -> Result<()> {
        instructions::initialize_record_counter(ctx)
    }

    pub fn register_tee(ctx: Context<RegisterTEENode>, pubkey: Vec<u8>, attestation: Vec<u8>) -> Result<()> {
        instructions::register_tee_node(ctx, pubkey, attestation)
    }

    pub fn register_organization(
        ctx: Context<RegisterOrganization>,
        name: String,
        description: String,
        contact_info: String,
    ) -> Result<()> {
        instructions::register_organization(ctx, name, description, contact_info)
    }

    pub fn upload_health_record(
        ctx: Context<UploadHealthRecord>,
        encrypted_data: String,
        mime_type: String,
        file_size: u64,
        description: String,
        title: String,
    ) -> Result<()> {
        instructions::upload_health_record(ctx, encrypted_data, mime_type, file_size, description, title)
    }

    pub fn grant_access(
        ctx: Context<GrantAccess>,
        record_id: u64,
        organization: Pubkey,
    ) -> Result<()> {
        instructions::grant_access(ctx, record_id, organization)
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


