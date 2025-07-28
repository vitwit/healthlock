use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserVault {
    pub owner: Pubkey,
    #[max_len(100)]
    pub record_ids: Vec<u64>,
    pub created_at: i64,
    pub is_active: bool,
    #[max_len(50)]
    pub name: String,
    pub age: u64,
}


