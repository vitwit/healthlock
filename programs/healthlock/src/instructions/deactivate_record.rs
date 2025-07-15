use anchor_lang::prelude::*;

use crate::state::*;

pub fn deactivate_record(ctx: Context<DeactivateRecord>) -> Result<()> {
    msg!("unimplemented: {:?}", ctx.program_id);
    Ok(())
}

#[derive(Accounts)]
pub struct DeactivateRecord<'info> {
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
        mut,
        seeds = [b"health_record", owner.key().as_ref(), record_counter.record_id.to_le_bytes().as_ref()],
        bump
    )]
    pub health_record: Account<'info, HealthRecord>,

    #[account(mut)]
    pub owner: Signer<'info>,
}