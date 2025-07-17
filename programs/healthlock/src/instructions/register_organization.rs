use anchor_lang::prelude::*;

use crate::{events::*, state::*, ANCHOR_DESCRIMINATOR_SIZE};


pub fn initialize_organization_counter(ctx: Context<InitializeOrganizationCounter>) -> Result<()> {
    ctx.accounts.organization_counter.organization_id = 1;
    Ok(())
}

pub fn register_organization(
    ctx: Context<RegisterOrganization>,
    name: String,
    contact_info: String,
) -> Result<()> {
    let organization = &mut ctx.accounts.organization;
    let organization_counter = &mut ctx.accounts.organization_counter;

    organization.owner = ctx.accounts.owner.key();
    organization.organization_id = organization_counter.organization_id;
    organization.name = name;

    organization.contact_info = contact_info;

    organization.created_at = Clock::get()?.unix_timestamp;
    organization.is_active = true;

    emit!(OrganizationRegistered {
        owner: ctx.accounts.owner.key(),
        organization_id: organization_counter.organization_id,
        organization_account: organization.key(),
        name: organization.name.clone(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    organization_counter.organization_id += 1;

    msg!(
        "Organization registered successfully with ID: {}",
        organization.organization_id
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeOrganizationCounter<'info> {
    #[account(
        init,
        payer = owner,
        space = ANCHOR_DESCRIMINATOR_SIZE + OrganizationCounter::INIT_SPACE,
        seeds = [b"organization_counter"],
        bump
    )]
    pub organization_counter: Account<'info, OrganizationCounter>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterOrganization<'info> {
    #[account(
        mut,
        seeds = [b"organization_counter"],
        bump
    )]
    pub organization_counter: Account<'info, OrganizationCounter>,

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
