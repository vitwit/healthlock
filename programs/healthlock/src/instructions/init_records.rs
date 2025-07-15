use anchor_lang::prelude::*;
use crate::{ANCHOR_DESCRIMINATOR_SIZE, state::*};


pub fn initialize_record_counter(ctx: Context<InitializeRecordCounter>) -> Result<()> {
    ctx.accounts.record_counter.record_id = 1;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeRecordCounter<'info> {
    #[account(
        init,
        payer = owner,
        space = ANCHOR_DESCRIMINATOR_SIZE + RecordCounter::INIT_SPACE,
        seeds = [b"record_counter"],
        bump
    )]
    pub record_counter: Account<'info, RecordCounter>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

