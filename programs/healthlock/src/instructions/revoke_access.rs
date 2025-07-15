use anchor_lang::prelude::*;

use crate::state::*;

pub fn revoke_access(
    ctx: Context<RevokeAccess>,
    organization: Pubkey,
) -> Result<()> {
    msg!("unimplemented: {:?}", ctx.program_id);
    Ok(())
}


#[derive(Accounts)]
pub struct RevokeAccess<'info> {
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
