use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct RecordCounter {
    pub record_id: u64,
}
