use anchor_lang::prelude::*;

use crate::{events::*, state::*, ANCHOR_DESCRIMINATOR_SIZE};


pub fn register_organization(
    ctx: Context<RegisterOrganization>,
    name: String,
    description: String,
    contact_info: String,
) -> Result<()> {
    let organization = &mut ctx.accounts.organization;

    organization.owner = ctx.accounts.owner.key();
    organization.name = name;

    organization.contact_info = contact_info;
    organization.description = description;

    organization.created_at = Clock::get()?.unix_timestamp;

    emit!(OrganizationRegistered {
        owner: ctx.accounts.owner.key(),
        organization_account: organization.key(),
        name: organization.name.clone(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Organization registered successfully with name: {}",
        organization.name
    );
    Ok(())
}

#[derive(Accounts)]
pub struct RegisterOrganization<'info> {
    #[account(
        init,
        payer = owner,
        space = ANCHOR_DESCRIMINATOR_SIZE + Organization::INIT_SPACE,
        seeds = [b"organization", owner.key().as_ref()],
        bump
    )]
    pub organization: Account<'info, Organization>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}
