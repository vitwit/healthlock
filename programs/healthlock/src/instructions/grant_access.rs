use anchor_lang::prelude::*;

use crate::state::*;

pub fn grant_access(
    ctx: Context<GrantAccess>,
    organization: Pubkey,
    access_duration: Option<i64>,
) -> Result<()> {
    msg!("unimplemented: {:?}", ctx.program_id);
    Ok(())
}

#[derive(Accounts)]
pub struct GrantAccess<'info> {
    #[account(
        mut,
        seeds = [b"record_counter"],
        bump
    )]
    pub record_counter: Account<'info, RecordCounter>,

    #[account(
        mut,
        seeds = [b"health_record", owner.key().as_ref(), record_counter.record_id.to_le_bytes().as_ref()],
        bump
    )]
    pub health_record: Account<'info, HealthRecord>,

    #[account(mut)]
    pub owner: Signer<'info>,
}
